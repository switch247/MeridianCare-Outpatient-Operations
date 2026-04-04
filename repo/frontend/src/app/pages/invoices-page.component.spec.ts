import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { InvoicesPageComponent } from './invoices-page.component';
import { ApiService } from '../services/api.service';

describe('InvoicesPageComponent', () => {
  let fixture: ComponentFixture<InvoicesPageComponent>;
  let component: InvoicesPageComponent;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('ApiService', [
      'getInvoices',
      'getPatients',
      'billPrice',
      'createInvoice',
      'payInvoice',
      'cancelInvoice',
      'getInvoice',
    ]);
    apiSpy.getInvoices.and.returnValue(of({ items: [{ id: 'inv-1', state: 'unpaid' }], total: 1 }));
    apiSpy.getPatients.and.returnValue(of([]));
    apiSpy.billPrice.and.returnValue(of({ total: 100 }));
    apiSpy.createInvoice.and.returnValue(of({ id: 'inv-2' }));
    apiSpy.payInvoice.and.returnValue(of({}));
    apiSpy.cancelInvoice.and.returnValue(of({}));
    apiSpy.getInvoice.and.returnValue(of({ id: 'inv-1' }));

    await TestBed.configureTestingModule({
      imports: [InvoicesPageComponent],
      providers: [{ provide: ApiService, useValue: apiSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(InvoicesPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads invoices from envelope responses', () => {
    expect(component.invoices.length).toBe(1);
    expect(component.invoices[0].id).toBe('inv-1');
  });

  it('builds home-delivery payload with shipping details', () => {
    component.modalModel = {
      patientId: 'p-1',
      lines: [{ chargeType: 'visit_code', description: 'Visit', quantity: 1, unitPrice: 100 }],
      planPercent: 10,
      couponAmount: 0,
      thresholdMin: 100,
      thresholdOff: 10,
      deliveryType: 'home_delivery',
      zone: 'US-EAST',
      zip: '73301',
      city: 'Austin',
      state: 'TX',
      addressLine1: '1 Main',
      carrier: 'LocalCarrier',
    };
    const payload = component.buildPayloadFrom(component.modalModel);
    expect(payload.shipping).toEqual(jasmine.objectContaining({ deliveryType: 'home_delivery', zone: 'US-EAST', zip: '73301' }));
  });
});
