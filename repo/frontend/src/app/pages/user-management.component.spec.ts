import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { UserManagementComponent } from './user-management.component';
import { ApiService } from '../services/api.service';

describe('UserManagementComponent', () => {
  let fixture: ComponentFixture<UserManagementComponent>;
  let component: UserManagementComponent;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('ApiService', ['getUsers', 'createUser', 'updateUser', 'deleteUser', 'unlockUser']);
    apiSpy.getUsers.and.returnValue(of([{ id: '1', username: 'alice', role: 'admin', lockout_until: null }]));
    apiSpy.createUser.and.returnValue(of({}));
    apiSpy.updateUser.and.returnValue(of({}));
    apiSpy.deleteUser.and.returnValue(of({}));
    apiSpy.unlockUser.and.returnValue(of({}));

    await TestBed.configureTestingModule({
      imports: [UserManagementComponent],
      providers: [{ provide: ApiService, useValue: apiSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(UserManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads users on init', () => {
    expect(apiSpy.getUsers).toHaveBeenCalled();
    expect(component.users.length).toBe(1);
  });

  it('creates user from modal model', () => {
    component.openCreate();
    component.modalModel = { username: 'bob', password: 'StrongPass123', role: 'physician' };
    component.saveModal();
    expect(apiSpy.createUser).toHaveBeenCalled();
  });

  it('updates existing user', () => {
    component.openEdit({ id: '1', username: 'alice', role: 'admin' });
    component.modalModel.username = 'alice2';
    component.saveModal();
    expect(apiSpy.updateUser).toHaveBeenCalledWith('1', jasmine.objectContaining({ username: 'alice2' }));
  });
});
