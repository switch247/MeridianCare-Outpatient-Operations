import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MyClinicComponent } from './my-clinic.component';
import { ApiService } from '../services/api.service';

describe('MyClinicComponent', () => {
  let fixture: ComponentFixture<MyClinicComponent>;
  let component: MyClinicComponent;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const mockClinic = {
    id: 'clinic-1',
    name: 'Test Clinic',
    type: 'clinical',
    address: '123 Main St',
    contactInfo: { email: 'clinic@example.com', phone: '555-1234' },
  };

  const mockKpis = { orderVolume: 20, acceptanceRate: 0.9 };

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', [
      'getClinic',
      'updateClinic',
      'getMe',
      'getKpis',
    ]);
    apiSpy.getClinic.and.returnValue(of(mockClinic));
    apiSpy.getMe.and.returnValue(of({ id: 'u1', role: 'admin' }));
    apiSpy.getKpis.and.returnValue(of(mockKpis));

    await TestBed.configureTestingModule({
      imports: [MyClinicComponent],
      providers: [{ provide: ApiService, useValue: apiSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(MyClinicComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads clinic on init', () => {
    expect(apiSpy.getClinic).toHaveBeenCalled();
    expect(component.clinic.name).toBe('Test Clinic');
    expect(component.clinic.contactInfo.email).toBe('clinic@example.com');
  });

  it('loads current user on init', () => {
    expect(apiSpy.getMe).toHaveBeenCalled();
    expect(component.currentUser.role).toBe('admin');
  });

  it('loads KPIs on init', () => {
    expect(apiSpy.getKpis).toHaveBeenCalled();
    expect(component.kpis).toEqual(mockKpis);
  });

  it('handles clinic load error gracefully', () => {
    apiSpy.getClinic.and.returnValue(throwError(() => ({ status: 403 })));
    component.load();
    expect(component.clinic).toBeNull();
  });

  it('handles getMe error gracefully', () => {
    apiSpy.getMe.and.returnValue(throwError(() => ({ status: 401 })));
    component.loadMe();
    expect(component.currentUser).toBeNull();
  });

  it('openEdit populates edit model from clinic', () => {
    component.openEdit();
    expect(component.modalOpen).toBeTrue();
    expect(component.edit.name).toBe('Test Clinic');
    expect(component.edit.address).toBe('123 Main St');
    expect(component.edit.contactInfo.email).toBe('clinic@example.com');
  });

  it('openEdit does nothing when clinic is null', () => {
    component.clinic = null;
    component.openEdit();
    expect(component.modalOpen).toBeFalse();
  });

  it('closeModal sets modalOpen to false', () => {
    component.modalOpen = true;
    component.closeModal();
    expect(component.modalOpen).toBeFalse();
  });

  it('save calls updateClinic and updates clinic on success', () => {
    apiSpy.updateClinic.and.returnValue(of({
      id: 'clinic-1',
      name: 'Updated Clinic',
      contactInfo: { email: 'new@example.com' },
    }));
    component.openEdit();
    component.edit.name = 'Updated Clinic';
    component.save();
    expect(apiSpy.updateClinic).toHaveBeenCalledWith(
      'clinic-1',
      jasmine.objectContaining({ name: 'Updated Clinic' }),
    );
    expect(component.clinic.name).toBe('Updated Clinic');
    expect(component.modalOpen).toBeFalse();
  });

  it('save does nothing when clinic has no id', () => {
    component.clinic = { name: 'Nameless' };
    component.save();
    expect(apiSpy.updateClinic).not.toHaveBeenCalled();
  });

  it('save closes modal on error', () => {
    apiSpy.updateClinic.and.returnValue(throwError(() => ({ status: 500 })));
    component.openEdit();
    component.save();
    expect(component.modalOpen).toBeFalse();
  });
});
