import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CredentialingPageComponent } from './credentialing-page.component';
import { ApiService } from '../services/api.service';

describe('CredentialingPageComponent', () => {
  let fixture: ComponentFixture<CredentialingPageComponent>;
  let component: CredentialingPageComponent;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const mockProfiles = [
    { id: 'cp-1', full_name: 'Dr. Alice', entity_type: 'physician', license_number: 'LIC-001', license_expiry: '2026-01-01', status: 'active' },
  ];

  const mockOrgs = [
    { id: 'org-1', name: 'Health Network A', organization_type: 'healthcare', status: 'active' },
  ];

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', [
      'getCredentialingProfiles',
      'getOrganizations',
      'createOrganization',
      'updateOrganization',
      'deleteOrganization',
      'importCredentialing',
      'exportCredentialing',
    ]);
    apiSpy.getCredentialingProfiles.and.returnValue(of(mockProfiles));
    apiSpy.getOrganizations.and.returnValue(of(mockOrgs));

    await TestBed.configureTestingModule({
      imports: [CredentialingPageComponent],
      providers: [{ provide: ApiService, useValue: apiSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(CredentialingPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads profiles on init', () => {
    expect(apiSpy.getCredentialingProfiles).toHaveBeenCalled();
    expect(component.profiles).toEqual(mockProfiles);
  });

  it('loads organizations on init', () => {
    expect(apiSpy.getOrganizations).toHaveBeenCalled();
    expect(component.organizations).toEqual(mockOrgs);
  });

  it('handles profile load error gracefully', () => {
    apiSpy.getCredentialingProfiles.and.returnValue(throwError(() => ({ status: 403 })));
    component.loadProfiles();
    expect(component.profiles).toEqual([]);
  });

  it('handles organization load error gracefully', () => {
    apiSpy.getOrganizations.and.returnValue(throwError(() => ({ status: 403 })));
    component.loadOrganizations();
    expect(component.organizations).toEqual([]);
  });

  it('editOrganization populates organization form from org record', () => {
    component.editOrganization({ id: 'org-1', name: 'Health Net', organization_type: 'healthcare', contact_phone: '555-1234', address: '1 Main', status: 'active' });
    expect(component.organization.id).toBe('org-1');
    expect(component.organization.name).toBe('Health Net');
    expect(component.organization.organizationType).toBe('healthcare');
  });

  it('saveOrganization calls createOrganization when no id set', () => {
    apiSpy.createOrganization.and.returnValue(of({ id: 'org-2' }));
    component.organization = { id: '', name: 'New Org', organizationType: 'clinic', contactEmail: 'a@b.com', contactPhone: '', address: '', status: 'active' };
    component.saveOrganization();
    expect(apiSpy.createOrganization).toHaveBeenCalledWith(jasmine.objectContaining({ name: 'New Org' }));
    expect(component.message).toBe('Organization saved');
  });

  it('saveOrganization calls updateOrganization when id is set', () => {
    apiSpy.updateOrganization.and.returnValue(of({ id: 'org-1' }));
    component.organization = { id: 'org-1', name: 'Updated Org', organizationType: 'clinic', contactEmail: '', contactPhone: '', address: '', status: 'active' };
    component.saveOrganization();
    expect(apiSpy.updateOrganization).toHaveBeenCalledWith('org-1', jasmine.objectContaining({ name: 'Updated Org' }));
    expect(component.message).toBe('Organization saved');
  });

  it('saveOrganization resets form on success', () => {
    apiSpy.createOrganization.and.returnValue(of({ id: 'org-3' }));
    component.organization.name = 'Temp Org';
    component.saveOrganization();
    expect(component.organization.name).toBe('');
    expect(component.organization.id).toBe('');
  });

  it('saveOrganization shows error on failure', () => {
    apiSpy.createOrganization.and.returnValue(throwError(() => ({ error: { msg: 'Name conflict' } })));
    component.organization = { id: '', name: 'Dup Org', organizationType: 'clinic', contactEmail: '', contactPhone: '', address: '', status: 'active' };
    component.saveOrganization();
    expect(component.message).toBe('Name conflict');
  });

  it('deleteOrganization calls deleteOrganization api and reloads', () => {
    apiSpy.deleteOrganization.and.returnValue(of({}));
    component.deleteOrganization('org-1');
    expect(apiSpy.deleteOrganization).toHaveBeenCalledWith('org-1');
    expect(component.message).toBe('Organization deleted');
    expect(apiSpy.getOrganizations).toHaveBeenCalledTimes(2);
  });

  it('deleteOrganization shows error on failure', () => {
    apiSpy.deleteOrganization.and.returnValue(throwError(() => ({ error: { msg: 'Not found' } })));
    component.deleteOrganization('org-99');
    expect(component.message).toBe('Not found');
  });

  it('addBatchRow pushes a copy of batchRow and resets form', () => {
    component.batchRow = { entityType: 'candidate', fullName: 'Dr. Smith', licenseNumber: 'LIC-123', licenseExpiry: '2026-06-01' };
    component.addBatchRow();
    expect(component.batchRows.length).toBe(1);
    expect(component.batchRows[0].fullName).toBe('Dr. Smith');
    expect(component.batchRow.fullName).toBe('');
  });

  it('importBatch calls importCredentialing with rows and mapping', () => {
    apiSpy.importCredentialing.and.returnValue(of({ accepted: 2, rejected: 0, errors: [] }));
    component.batchRows = [
      { entityType: 'candidate', fullName: 'Jane', licenseNumber: 'L1', licenseExpiry: '2026-12-01' },
    ];
    component.importBatch();
    expect(apiSpy.importCredentialing).toHaveBeenCalledWith(
      component.batchRows,
      component.fieldMapping,
    );
    expect(component.importSummary).toEqual({ accepted: 2, rejected: 0, errors: [] });
    expect(component.message).toBe('Import complete');
  });

  it('importBatch shows error on failure', () => {
    apiSpy.importCredentialing.and.returnValue(throwError(() => ({ error: { msg: 'Malformed CSV' } })));
    component.importBatch();
    expect(component.message).toBe('Malformed CSV');
  });

  it('exportData calls exportCredentialing and sets exportSummary', () => {
    const exported = [{ id: 'cp-1', full_name: 'Dr. Alice' }];
    apiSpy.exportCredentialing.and.returnValue(of(exported));
    component.exportData();
    expect(apiSpy.exportCredentialing).toHaveBeenCalled();
    expect(component.exportSummary).toEqual(exported);
    expect(component.message).toBe('Export ready');
  });

  it('exportData shows error on failure', () => {
    apiSpy.exportCredentialing.and.returnValue(throwError(() => ({ error: { msg: 'Export error' } })));
    component.exportData();
    expect(component.message).toBe('Export error');
  });
});
