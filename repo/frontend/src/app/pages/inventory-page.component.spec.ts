import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { InventoryPageComponent } from './inventory-page.component';
import { ApiService } from '../services/api.service';

describe('InventoryPageComponent', () => {
  let fixture: ComponentFixture<InventoryPageComponent>;
  let component: InventoryPageComponent;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const mockItems = [
    { id: 'item-1', sku: 'SKU-001', name: 'Drug A', on_hand: 10, low_stock_threshold: 5 },
    { id: 'item-2', sku: 'SKU-002', name: 'Drug B', on_hand: 2, low_stock_threshold: 5 },
  ];

  const mockAlerts = [
    { sku: 'SKU-002', name: 'Drug B', on_hand: 2, low_stock_threshold: 5 },
  ];

  const mockVariance = [
    { item_id: 'item-1', positive_adjustments: 10, negative_adjustments: 2 },
  ];

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', [
      'getInventory',
      'getLowStockAlerts',
      'getInventoryVariance',
      'createInventoryItem',
      'createInventoryMovement',
    ]);
    apiSpy.getInventory.and.returnValue(of(mockItems));
    apiSpy.getLowStockAlerts.and.returnValue(of(mockAlerts));
    apiSpy.getInventoryVariance.and.returnValue(of(mockVariance));

    await TestBed.configureTestingModule({
      imports: [InventoryPageComponent],
      providers: [{ provide: ApiService, useValue: apiSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads items, alerts, and variance on init', () => {
    expect(component.items).toEqual(mockItems);
    expect(component.alerts).toEqual(mockAlerts);
    expect(component.variance).toEqual(mockVariance);
  });

  it('handles load error for items gracefully', () => {
    apiSpy.getInventory.and.returnValue(throwError(() => ({ status: 500 })));
    component.load();
    expect(component.items).toEqual([]);
  });

  it('handles load error for alerts gracefully', () => {
    apiSpy.getLowStockAlerts.and.returnValue(throwError(() => ({ status: 500 })));
    apiSpy.getInventory.and.returnValue(of(mockItems));
    apiSpy.getInventoryVariance.and.returnValue(of(mockVariance));
    component.load();
    expect(component.alerts).toEqual([]);
  });

  it('createItem calls createInventoryItem with model', () => {
    apiSpy.createInventoryItem.and.returnValue(of({ id: 'item-3' }));
    component.createModel = { sku: 'NEW-SKU', name: 'New Drug', lowStockThreshold: 5, lotTracking: false, serialTracking: false };
    component.createItem();
    expect(apiSpy.createInventoryItem).toHaveBeenCalledWith(component.createModel);
    expect(component.message).toBe('Inventory item created.');
    expect(component.openCreate).toBeFalse();
  });

  it('createItem resets createModel on success', () => {
    apiSpy.createInventoryItem.and.returnValue(of({ id: 'item-3' }));
    component.createModel.sku = 'NEW-SKU';
    component.createItem();
    expect(component.createModel.sku).toBe('');
  });

  it('createItem shows error message on failure', () => {
    apiSpy.createInventoryItem.and.returnValue(throwError(() => ({ error: { msg: 'SKU conflict' } })));
    component.createItem();
    expect(component.message).toBe('SKU conflict');
  });

  it('selectForMove sets selectedItem and resets moveModel', () => {
    component.selectForMove(mockItems[0]);
    expect(component.selectedItem).toEqual(mockItems[0]);
    expect(component.moveModel.movementType).toBe('receive');
    expect(component.moveModel.quantity).toBe(1);
  });

  it('applyMovement calls createInventoryMovement with correct payload', () => {
    apiSpy.createInventoryMovement.and.returnValue(of({}));
    component.selectedItem = mockItems[0];
    component.moveModel = { movementType: 'receive', quantity: 5, lot: 'L1', serial: '', reason: '' };
    component.applyMovement();
    expect(apiSpy.createInventoryMovement).toHaveBeenCalledWith(jasmine.objectContaining({
      itemId: 'item-1',
      movementType: 'receive',
      quantity: 5,
      lot: 'L1',
    }));
    expect(component.message).toBe('Movement applied.');
  });

  it('applyMovement omits empty optional fields from payload', () => {
    apiSpy.createInventoryMovement.and.returnValue(of({}));
    component.selectedItem = mockItems[0];
    component.moveModel = { movementType: 'dispense', quantity: 2, lot: '', serial: '', reason: '' };
    component.applyMovement();
    const calledWith = (apiSpy.createInventoryMovement.calls.mostRecent().args[0] as any);
    expect(calledWith.lot).toBeUndefined();
    expect(calledWith.serial).toBeUndefined();
    expect(calledWith.reason).toBeUndefined();
  });

  it('applyMovement does nothing when no item selected', () => {
    component.selectedItem = null;
    component.applyMovement();
    expect(apiSpy.createInventoryMovement).not.toHaveBeenCalled();
  });

  it('applyMovement shows error on failure', () => {
    apiSpy.createInventoryMovement.and.returnValue(throwError(() => ({ error: { msg: 'Insufficient stock' } })));
    component.selectedItem = mockItems[1];
    component.applyMovement();
    expect(component.message).toBe('Insufficient stock');
  });
});
