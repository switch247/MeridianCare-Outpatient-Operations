function computeBackoffSeconds(retries) {
  return Math.min(30 * (2 ** Math.max(0, Number(retries))), 900);
}

function nextStage(stage) {
  if (stage === 'collect') return 'parse';
  if (stage === 'parse') return 'store';
  if (stage === 'store') return 'completed';
  return 'completed';
}

/**
 * NodeOrchestrator manages a pool of crawler worker nodes.
 * It tracks active nodes, provisions/decommissions nodes based on
 * autoscaling signals, and persists state to the database.
 */
class NodeOrchestrator {
  constructor(pool, logger) {
    this.pool = pool;
    this.logger = logger;
    this.MIN_NODES = 1;
    this.MAX_NODES = 8;
    this.JOBS_PER_NODE = 5;
  }

  async getActiveNodes() {
    const res = await this.pool.query(
      `SELECT * FROM crawler_nodes WHERE state='active' ORDER BY node_id ASC`,
    );
    return res.rows;
  }

  async ensureNodesTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS crawler_nodes (
        node_id TEXT PRIMARY KEY,
        state TEXT NOT NULL DEFAULT 'active',
        capacity INT NOT NULL DEFAULT 5,
        current_load INT NOT NULL DEFAULT 0,
        provisioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async provisionNode(nodeId) {
    await this.pool.query(
      `INSERT INTO crawler_nodes(node_id,state,capacity,current_load,provisioned_at,last_heartbeat)
       VALUES($1,'active',$2,0,NOW(),NOW())
       ON CONFLICT (node_id) DO UPDATE SET state='active',last_heartbeat=NOW()`,
      [nodeId, this.JOBS_PER_NODE],
    );
    this.logger.info(['orchestrator', 'provision'], `Node ${nodeId} provisioned`);
  }

  async decommissionNode(nodeId) {
    const activeJobs = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM crawler_jobs WHERE node_id=$1 AND state IN ('queued','retry_wait')`,
      [nodeId],
    );
    if (Number(activeJobs.rows[0].count) > 0) {
      await this.pool.query(
        `UPDATE crawler_jobs SET node_id=NULL WHERE node_id=$1 AND state IN ('queued','retry_wait')`,
        [nodeId],
      );
    }
    await this.pool.query(
      `UPDATE crawler_nodes SET state='decommissioned' WHERE node_id=$1`,
      [nodeId],
    );
    this.logger.info(['orchestrator', 'decommission'], `Node ${nodeId} decommissioned, ${activeJobs.rows[0].count} jobs reassigned`);
  }

  async applyScaling() {
    await this.ensureNodesTable();

    const queueRes = await this.pool.query(
      "SELECT COUNT(*)::int AS count FROM crawler_jobs WHERE state IN ('queued','retry_wait')",
    );
    const queueDepth = Number(queueRes.rows[0].count);
    const desiredNodes = Math.max(this.MIN_NODES, Math.min(this.MAX_NODES, Math.ceil(queueDepth / this.JOBS_PER_NODE)));

    const activeNodes = await this.getActiveNodes();
    const currentCount = activeNodes.length || 1;

    const actions = [];

    if (desiredNodes > currentCount) {
      for (let i = currentCount + 1; i <= desiredNodes; i++) {
        const nodeId = `node-${i}`;
        await this.provisionNode(nodeId);
        actions.push({ type: 'provision', nodeId });
      }
    } else if (desiredNodes < currentCount) {
      const toRemove = activeNodes
        .sort((a, b) => Number(a.current_load) - Number(b.current_load))
        .slice(desiredNodes);
      for (const node of toRemove) {
        await this.decommissionNode(node.node_id);
        actions.push({ type: 'decommission', nodeId: node.node_id });
      }
    }

    // Ensure at least node-1 exists
    if (activeNodes.length === 0) {
      await this.provisionNode('node-1');
      actions.push({ type: 'provision', nodeId: 'node-1' });
    }

    // Update load counts for active nodes
    const loadRes = await this.pool.query(
      `SELECT COALESCE(node_id,'node-1') AS node_id, COUNT(*)::int AS load
       FROM crawler_jobs WHERE state IN ('queued','retry_wait')
       GROUP BY COALESCE(node_id,'node-1')`,
    );
    for (const row of loadRes.rows) {
      await this.pool.query(
        `UPDATE crawler_nodes SET current_load=$1,last_heartbeat=NOW() WHERE node_id=$2 AND state='active'`,
        [Number(row.load), row.node_id],
      );
    }

    return {
      queueDepth,
      previousNodes: currentCount,
      desiredNodes,
      currentNodes: desiredNodes,
      action: desiredNodes > currentCount ? 'scale_out' : desiredNodes < currentCount ? 'scale_in' : 'steady',
      applied: true,
      actions,
    };
  }

  async assignNode(preferredNodeId) {
    await this.ensureNodesTable();
    if (preferredNodeId) return preferredNodeId;

    const activeNodes = await this.getActiveNodes();
    if (activeNodes.length === 0) {
      await this.provisionNode('node-1');
      return 'node-1';
    }

    // Pick the node with least current load
    const loadRes = await this.pool.query(
      `SELECT COALESCE(node_id,'node-1') AS node_id, COUNT(*)::int AS active_count
       FROM crawler_jobs
       WHERE state IN ('queued','retry_wait')
       GROUP BY COALESCE(node_id,'node-1')
       ORDER BY active_count ASC, node_id ASC`,
    );
    const counts = {};
    for (const node of activeNodes) counts[node.node_id] = 0;
    for (const w of loadRes.rows) {
      if (counts[w.node_id] !== undefined) counts[w.node_id] = Number(w.active_count);
    }
    return Object.keys(counts).sort((a, b) => counts[a] - counts[b] || a.localeCompare(b))[0] || 'node-1';
  }
}

module.exports = { computeBackoffSeconds, nextStage, NodeOrchestrator };
