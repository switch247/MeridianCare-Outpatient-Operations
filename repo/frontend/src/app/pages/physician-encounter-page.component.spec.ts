import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PhysicianEncounterPageComponent } from './physician-encounter-page.component';
import { ApiService } from '../services/api.service';

describe('PhysicianEncounterPageComponent', () => {
  let fixture: ComponentFixture<PhysicianEncounterPageComponent>;
  let component: PhysicianEncounterPageComponent;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const mockPatients = [
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' },
  ];

  const mockEncounter = { id: 'enc-1', version: 1, state: 'unsigned', diagnoses: [{ code: 'J06.9', label: 'URI' }] };

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', [
      'getPatients',
      'searchIcd',
      'getEncounters',
      'createEncounter',
      'signEncounter',
      'createPrescription',
    ]);
    apiSpy.getPatients.and.returnValue(of(mockPatients));
    apiSpy.searchIcd.and.returnValue(of([{ code: 'J06.9', label: 'URI' }]));
    apiSpy.getEncounters.and.returnValue(of([mockEncounter]));
    apiSpy.createEncounter.and.returnValue(of(mockEncounter));
    apiSpy.signEncounter.and.returnValue(of({ ...mockEncounter, state: 'signed', version: 2 }));
    apiSpy.createPrescription.and.returnValue(of({ id: 'rx-1' }));

    await TestBed.configureTestingModule({
      imports: [PhysicianEncounterPageComponent],
      providers: [{ provide: ApiService, useValue: apiSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(PhysicianEncounterPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads patients on init', () => {
    expect(apiSpy.getPatients).toHaveBeenCalled();
    expect(component.patients).toEqual(mockPatients);
  });

  it('handles patient load error gracefully', () => {
    apiSpy.getPatients.and.returnValue(throwError(() => ({ status: 403 })));
    component.loadPatients();
    expect(component.patients).toEqual([]);
  });

  it('searchIcd calls api and populates results when query >= 2 chars', () => {
    component.icdQuery = 'J0';
    component.searchIcd();
    expect(apiSpy.searchIcd).toHaveBeenCalledWith('J0');
    expect(component.icdResults.length).toBe(1);
  });

  it('searchIcd clears results when query < 2 chars', () => {
    component.icdResults = [{ code: 'J06.9' }];
    component.icdQuery = 'J';
    component.searchIcd();
    expect(apiSpy.searchIcd).not.toHaveBeenCalled();
    expect(component.icdResults).toEqual([]);
  });

  it('addDiagnosis adds an ICD item to encounter diagnoses', () => {
    component.addDiagnosis({ code: 'J06.9', label: 'URI' });
    expect(component.encounter.diagnoses.length).toBe(1);
    expect(component.encounter.diagnoses[0].code).toBe('J06.9');
  });

  it('addDiagnosis does not add duplicate codes', () => {
    component.addDiagnosis({ code: 'J06.9', label: 'URI' });
    component.addDiagnosis({ code: 'J06.9', label: 'URI duplicate' });
    expect(component.encounter.diagnoses.length).toBe(1);
  });

  it('removeDiagnosis removes diagnosis by index', () => {
    component.encounter.diagnoses = [{ code: 'J06.9' }, { code: 'Z00.00' }];
    component.removeDiagnosis(0);
    expect(component.encounter.diagnoses.length).toBe(1);
    expect(component.encounter.diagnoses[0].code).toBe('Z00.00');
  });

  it('createEncounter calls api and sets latestEncounter on success', () => {
    component.selectedPatientId = 'p1';
    component.encounter = { chiefComplaint: 'Fever', treatment: 'Rest', followUp: '3 days', diagnoses: [{ code: 'J06.9' }] };
    component.createEncounter();
    expect(apiSpy.createEncounter).toHaveBeenCalledWith(jasmine.objectContaining({ patientId: 'p1', chiefComplaint: 'Fever' }));
    expect(component.latestEncounter).toEqual(mockEncounter);
    expect(component.message).toBe('Encounter created.');
  });

  it('createEncounter sets error message on failure', () => {
    apiSpy.createEncounter.and.returnValue(throwError(() => ({ error: { msg: 'Missing diagnoses' } })));
    component.selectedPatientId = 'p1';
    component.createEncounter();
    expect(component.message).toBe('Missing diagnoses');
  });

  it('loadPatientEncounters fetches encounters for selected patient', () => {
    component.selectedPatientId = 'p1';
    component.loadPatientEncounters();
    expect(apiSpy.getEncounters).toHaveBeenCalledWith('p1');
    expect(component.encounters).toEqual([mockEncounter]);
    expect(component.latestEncounter).toEqual(mockEncounter);
  });

  it('loadPatientEncounters does nothing when no patient selected', () => {
    component.selectedPatientId = '';
    component.loadPatientEncounters();
    expect(apiSpy.getEncounters).not.toHaveBeenCalled();
  });

  it('signLatest calls signEncounter with correct version', () => {
    component.latestEncounter = mockEncounter;
    component.signLatest();
    expect(apiSpy.signEncounter).toHaveBeenCalledWith('enc-1', 1);
    expect(component.message).toBe('Encounter signed.');
  });

  it('signLatest does nothing when no encounter loaded', () => {
    component.latestEncounter = null;
    component.signLatest();
    expect(apiSpy.signEncounter).not.toHaveBeenCalled();
  });

  it('signLatest sets error message on failure', () => {
    apiSpy.signEncounter.and.returnValue(throwError(() => ({ error: { msg: 'Version conflict' } })));
    component.latestEncounter = mockEncounter;
    component.signLatest();
    expect(component.message).toBe('Version conflict');
  });

  it('submitPrescription calls createPrescription with payload', () => {
    component.latestEncounter = mockEncounter;
    component.selectedPatientId = 'p1';
    component.prescription = { drugName: 'amoxicillin', dose: '500mg', route: 'oral', quantity: 10, instructions: 'BID', overrideReason: '', reauthPassword: '' };
    component.submitPrescription();
    expect(apiSpy.createPrescription).toHaveBeenCalledWith(jasmine.objectContaining({
      encounterId: 'enc-1',
      patientId: 'p1',
      drugName: 'amoxicillin',
    }));
    expect(component.message).toBe('Prescription submitted.');
  });

  it('submitPrescription includes overrideReason when set', () => {
    component.latestEncounter = mockEncounter;
    component.selectedPatientId = 'p1';
    component.prescription = { drugName: 'amoxicillin', dose: '500mg', route: 'oral', quantity: 10, instructions: 'BID', overrideReason: 'clinical necessity', reauthPassword: 'pass' };
    component.submitPrescription();
    const arg = (apiSpy.createPrescription.calls.mostRecent().args[0] as any);
    expect(arg.overrideReason).toBe('clinical necessity');
    expect(arg.reauthPassword).toBe('pass');
  });

  it('submitPrescription shows error when no encounter', () => {
    component.latestEncounter = null;
    component.selectedPatientId = 'p1';
    component.submitPrescription();
    expect(apiSpy.createPrescription).not.toHaveBeenCalled();
    expect(component.message).toBe('Create/sign an encounter first.');
  });

  it('submitPrescription shows error message on api failure', () => {
    apiSpy.createPrescription.and.returnValue(throwError(() => ({ error: { msg: 'Allergy conflict' } })));
    component.latestEncounter = mockEncounter;
    component.selectedPatientId = 'p1';
    component.submitPrescription();
    expect(component.message).toBe('Allergy conflict');
  });
});
