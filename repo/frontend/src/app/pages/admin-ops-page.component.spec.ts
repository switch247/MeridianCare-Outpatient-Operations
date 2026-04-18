import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminOpsPageComponent } from './admin-ops-page.component';
import { ApiService } from '../services/api.service';

describe('AdminOpsPageComponent', () => {
  let fixture: ComponentFixture<AdminOpsPageComponent>;
  let component: AdminOpsPageComponent;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const crawlerQueueResp = { items: [{ id: 'j1', sourceName: 'icd', priority: 1, state: 'pending' }], total: 1 };
  const driftResp = { items: [{ id: 'm1', model_type: 'visit_volume', version_tag: 'v1', baseline_score: 0.7, current_score: 0.82 }], total: 1 };
  const exceptionsResp = { items: [{ id: 'ex1', level: 'error', source: 'test', message: 'oops' }], total: 1 };

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', [
      'runCrawler',
      'processCrawlerNext',
      'getCrawlerQueue',
      'registerModel',
      'getModelDrift',
      'getForecasts',
      'getRecommendations',
      'createException',
      'getExceptions',
      'runNightlyBackup',
      'getNightlyBackups',
      'createRestoreDrill',
      'getRestoreDrills',
    ]);

    apiSpy.getCrawlerQueue.and.returnValue(of(crawlerQueueResp));
    apiSpy.getModelDrift.and.returnValue(of(driftResp));
    apiSpy.getExceptions.and.returnValue(of(exceptionsResp));
    apiSpy.getForecasts.and.returnValue(of({ predictions: [] }));
    apiSpy.getRecommendations.and.returnValue(of([]));
    apiSpy.getNightlyBackups.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [AdminOpsPageComponent],
      providers: [{ provide: ApiService, useValue: apiSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminOpsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads crawler jobs on init', () => {
    expect(apiSpy.getCrawlerQueue).toHaveBeenCalled();
    expect(component.crawlerJobs.length).toBe(1);
    expect(component.crawlerJobs[0].id).toBe('j1');
  });

  it('loads model drift on init', () => {
    expect(apiSpy.getModelDrift).toHaveBeenCalled();
    expect(component.modelTotal).toBe(1);
    expect(component.modelDriftDisplayed[0].modelType).toBe('visit_volume');
  });

  it('loads exceptions on init', () => {
    expect(apiSpy.getExceptions).toHaveBeenCalled();
    expect(component.exceptions.length).toBe(1);
  });

  it('loads backups on init', () => {
    expect(apiSpy.getNightlyBackups).toHaveBeenCalled();
  });

  it('queueCrawler calls runCrawler and reloads on success', () => {
    apiSpy.runCrawler.and.returnValue(of({ id: 'j2' }));
    component.queueCrawler();
    expect(apiSpy.runCrawler).toHaveBeenCalled();
    expect(component.message).toBe('Crawler job queued');
    expect(apiSpy.getCrawlerQueue).toHaveBeenCalledTimes(2);
  });

  it('queueCrawler shows error message on failure', () => {
    apiSpy.runCrawler.and.returnValue(throwError(() => ({ error: { msg: 'Queue failed' } })));
    component.queueCrawler();
    expect(component.message).toBe('Queue failed');
  });

  it('processCrawler calls processCrawlerNext', () => {
    apiSpy.processCrawlerNext.and.returnValue(of({}));
    component.processCrawler();
    expect(apiSpy.processCrawlerNext).toHaveBeenCalled();
    expect(component.message).toBe('Crawler processed');
  });

  it('registerModel calls registerModel api', () => {
    apiSpy.registerModel.and.returnValue(of({ id: 'm2' }));
    component.registerModel();
    expect(apiSpy.registerModel).toHaveBeenCalled();
    expect(component.message).toBe('Model registered');
  });

  it('createException calls createException api', () => {
    apiSpy.createException.and.returnValue(of({ id: 'ex2' }));
    component.createException();
    expect(apiSpy.createException).toHaveBeenCalled();
    expect(component.message).toBe('Exception alert recorded');
  });

  it('runBackup calls runNightlyBackup', () => {
    apiSpy.runNightlyBackup.and.returnValue(of({}));
    component.runBackup();
    expect(apiSpy.runNightlyBackup).toHaveBeenCalled();
    expect(component.message).toBe('Nightly backup completed');
  });

  it('runDrill calls createRestoreDrill', () => {
    apiSpy.createRestoreDrill.and.returnValue(of({ id: 'drill-1' }));
    component.runDrill();
    expect(apiSpy.createRestoreDrill).toHaveBeenCalled();
    expect(component.message).toBe('Restore drill recorded');
  });

  it('openDetail sets detailModel and detailOpen', () => {
    const obj = { id: 'x', level: 'warn' };
    component.openDetail(obj);
    expect(component.detailOpen).toBeTrue();
    expect(component.detailModel).toEqual(obj);
  });

  it('closeDetail clears detailModel and detailOpen', () => {
    component.detailOpen = true;
    component.detailModel = { id: 'x' };
    component.closeDetail();
    expect(component.detailOpen).toBeFalse();
    expect(component.detailModel).toBeNull();
  });

  it('objectKeys returns keys of an object', () => {
    expect(component.objectKeys({ a: 1, b: 2 })).toEqual(['a', 'b']);
  });

  it('objectKeys returns empty array for null', () => {
    expect(component.objectKeys(null)).toEqual([]);
  });

  it('min returns the smaller number', () => {
    expect(component.min(3, 7)).toBe(3);
    expect(component.min(10, 4)).toBe(4);
  });

  it('crawler pagination prev/next updates page and reloads', () => {
    component.crawlerTotal = 25;
    component.crawlerPage = 1;
    component.crawlerNext();
    expect(component.crawlerPage).toBe(2);

    component.crawlerPrev();
    expect(component.crawlerPage).toBe(1);
  });

  it('loadCrawler handles plain array response', () => {
    const arrResp = [{ id: 'j1' }, { id: 'j2' }];
    apiSpy.getCrawlerQueue.and.returnValue(of(arrResp));
    component.loadCrawler();
    expect(component.crawlerTotal).toBe(2);
  });

  it('loadDrift applies model query filter', () => {
    apiSpy.getModelDrift.and.returnValue(of(driftResp));
    component.modelQ = 'visit';
    component.loadDrift();
    expect(component.modelTotal).toBe(1);
  });

  it('loadDrift filter excludes non-matching entries', () => {
    apiSpy.getModelDrift.and.returnValue(of(driftResp));
    component.modelQ = 'NOMATCH_XYZ';
    component.loadDrift();
    expect(component.modelTotal).toBe(0);
  });
});
