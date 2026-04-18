import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PharmacistQueuePageComponent } from './pharmacist-queue-page.component';
import { ApiService } from '../services/api.service';

describe('PharmacistQueuePageComponent', () => {
  let fixture: ComponentFixture<PharmacistQueuePageComponent>;
  let component: PharmacistQueuePageComponent;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const pendingRx = { id: 'rx-1', drug_name: 'amoxicillin', state: 'pending', version: 1, quantity: 10, dispensed_quantity: 0, inventory_available: 20, lot_tracking: false, serial_tracking: false };
  const approvedRx = { id: 'rx-2', drug_name: 'ibuprofen', state: 'approved', version: 2, quantity: 8, dispensed_quantity: 0, inventory_available: 15, lot_tracking: false, serial_tracking: false };
  const dispensedRx = { id: 'rx-3', drug_name: 'warfarin', state: 'dispensed', version: 3, quantity: 5, dispensed_quantity: 5, inventory_available: 10, lot_tracking: true, serial_tracking: false };

  const mockMovements = [
    { id: 'mv-1', movement_type: 'dispense', quantity: 5, lot: 'L1', serial: null, reason: null },
  ];

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', [
      'getPharmacyQueue',
      'pharmacyAction',
      'getPharmacyMovements',
      'createPharmacyReturn',
    ]);
    apiSpy.getPharmacyQueue.and.returnValue(of([pendingRx, approvedRx, dispensedRx]));
    apiSpy.pharmacyAction.and.returnValue(of({ state: 'approved', version: 2 }));
    apiSpy.getPharmacyMovements.and.returnValue(of(mockMovements));
    apiSpy.createPharmacyReturn.and.returnValue(of({}));

    await TestBed.configureTestingModule({
      imports: [PharmacistQueuePageComponent],
      providers: [{ provide: ApiService, useValue: apiSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(PharmacistQueuePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads pharmacy queue on init', () => {
    expect(apiSpy.getPharmacyQueue).toHaveBeenCalled();
    expect(component.queue.length).toBe(3);
  });

  it('handles queue load error gracefully', () => {
    apiSpy.getPharmacyQueue.and.returnValue(throwError(() => ({ error: { msg: 'Queue unavailable' } })));
    component.loadQueue();
    expect(component.message).toBe('Queue unavailable');
    expect(component.busy).toBeFalse();
  });

  it('selectRx sets selectedRx and populates dispense defaults', () => {
    component.selectRx(approvedRx);
    expect(component.selectedRx).toEqual(approvedRx);
    expect(component.dispense.quantity).toBe(8);
    expect(component.voidReason).toBe('');
  });

  it('selectRx loads movements for the selected prescription', () => {
    component.selectRx(approvedRx);
    expect(apiSpy.getPharmacyMovements).toHaveBeenCalledWith('rx-2');
    expect(component.movements).toEqual(mockMovements);
  });

  it('approve calls pharmacyAction with approve action', () => {
    component.approve(pendingRx);
    expect(apiSpy.pharmacyAction).toHaveBeenCalledWith('rx-1', jasmine.objectContaining({ action: 'approve', expectedVersion: 1 }));
    expect(component.message).toBe('Prescription approved.');
  });

  it('approve shows error message on failure', () => {
    apiSpy.pharmacyAction.and.returnValue(throwError(() => ({ error: { msg: 'Already approved' } })));
    component.approve(pendingRx);
    expect(component.message).toBe('Already approved');
  });

  it('canDispense returns false when no selectedRx', () => {
    component.selectedRx = null;
    expect(component.canDispense()).toBeFalse();
  });

  it('canDispense returns false when no inventoryItemId', () => {
    component.selectedRx = approvedRx;
    component.dispense = { inventoryItemId: '', quantity: 5, lot: '', serial: '' };
    expect(component.canDispense()).toBeFalse();
  });

  it('canDispense returns true when all required fields present', () => {
    component.selectedRx = approvedRx;
    component.dispense = { inventoryItemId: 'item-1', quantity: 5, lot: '', serial: '' };
    expect(component.canDispense()).toBeTrue();
  });

  it('canDispense requires lot when lot_tracking is true', () => {
    component.selectedRx = dispensedRx;
    component.dispense = { inventoryItemId: 'item-1', quantity: 3, lot: '', serial: '' };
    expect(component.canDispense()).toBeFalse();

    component.dispense.lot = 'LOT-A';
    expect(component.canDispense()).toBeTrue();
  });

  it('dispenseSelected does nothing when canDispense is false', () => {
    component.selectedRx = null;
    component.dispenseSelected();
    expect(apiSpy.pharmacyAction).not.toHaveBeenCalled();
  });

  it('dispenseSelected calls pharmacyAction with dispense payload', () => {
    component.selectedRx = approvedRx;
    component.dispense = { inventoryItemId: 'item-1', quantity: 5, lot: '', serial: '' };
    component.dispenseSelected();
    expect(apiSpy.pharmacyAction).toHaveBeenCalledWith('rx-2', jasmine.objectContaining({
      action: 'dispense',
      inventoryItemId: 'item-1',
      dispenseQuantity: 5,
    }));
    expect(component.message).toBe('Dispense recorded.');
  });

  it('voidSelected requires a void reason', () => {
    component.selectedRx = approvedRx;
    component.voidReason = '';
    component.voidSelected();
    expect(apiSpy.pharmacyAction).not.toHaveBeenCalled();
    expect(component.message).toBe('Void reason is required.');
  });

  it('voidSelected calls pharmacyAction with void payload when reason is given', () => {
    component.selectedRx = approvedRx;
    component.voidReason = 'Medication discontinued';
    component.voidSelected();
    expect(apiSpy.pharmacyAction).toHaveBeenCalledWith('rx-2', jasmine.objectContaining({
      action: 'void',
      reason: 'Medication discontinued',
    }));
    expect(component.message).toBe('Prescription voided.');
  });

  it('returnFromMovement requires a return reason', () => {
    component.selectedRx = dispensedRx;
    component.returnReason = '';
    component.returnFromMovement({ id: 'mv-1', movement_type: 'dispense', quantity: 5 });
    expect(apiSpy.createPharmacyReturn).not.toHaveBeenCalled();
    expect(component.message).toBe('Return reason is required.');
  });

  it('returnFromMovement calls createPharmacyReturn with payload', () => {
    component.selectedRx = dispensedRx;
    component.returnReason = 'Unused medication';
    component.returnQuantity = 2;
    component.returnFromMovement({ id: 'mv-1', movement_type: 'dispense', quantity: 5 });
    expect(apiSpy.createPharmacyReturn).toHaveBeenCalledWith('rx-3', jasmine.objectContaining({
      originalMovementId: 'mv-1',
      quantity: 2,
      reason: 'Unused medication',
    }));
    expect(component.message).toBe('Return movement recorded.');
  });

  it('needsLot returns true when selectedRx has lot_tracking', () => {
    component.selectedRx = dispensedRx;
    expect(component.needsLot()).toBeTrue();
  });

  it('needsLot returns false when selectedRx has no lot_tracking', () => {
    component.selectedRx = pendingRx;
    expect(component.needsLot()).toBeFalse();
  });

  it('trackLabel returns "none" when no tracking flags', () => {
    expect(component.trackLabel(pendingRx)).toBe('none');
  });

  it('trackLabel returns lot when lot_tracking is set', () => {
    expect(component.trackLabel(dispensedRx)).toContain('lot');
  });

  it('loadMovements calls getPharmacyMovements for selected rx', () => {
    component.selectedRx = dispensedRx;
    component.loadMovements();
    expect(apiSpy.getPharmacyMovements).toHaveBeenCalledWith('rx-3');
  });

  it('loadMovements does nothing when no rx selected', () => {
    component.selectedRx = null;
    component.loadMovements();
    expect(apiSpy.getPharmacyMovements).not.toHaveBeenCalled();
  });
});
