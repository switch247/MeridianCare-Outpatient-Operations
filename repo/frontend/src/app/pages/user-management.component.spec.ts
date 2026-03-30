import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserManagementComponent } from './user-management.component';
import { ApiService } from '../services/api.service';

describe('UserManagementComponent', () => {
  let fixture: ComponentFixture<UserManagementComponent>;
  let component: UserManagementComponent;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('ApiService', ['getUsers', 'createUser', 'updateUser', 'deleteUser']);
    apiSpy.getUsers.and.returnValue(of([{ id: '1', username: 'alice', role: 'admin' }]));
    apiSpy.createUser.and.returnValue(of({}));
    apiSpy.updateUser.and.returnValue(of({}));
    apiSpy.deleteUser.and.returnValue(of({}));

    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule],
      providers: [{ provide: ApiService, useValue: apiSpy }],
      declarations: [],
    }).compileComponents();

    fixture = TestBed.createComponent(UserManagementComponent as any);
    component = fixture.componentInstance as UserManagementComponent;
    fixture.detectChanges();
  });

  it('loads users on init', () => {
    expect(apiSpy.getUsers).toHaveBeenCalled();
    expect(component.users.length).toBeGreaterThan(0);
    expect(component.users[0].username).toBe('alice');
  });

  it('starts and cancels edit correctly', () => {
    const u = component.users[0];
    component.startEdit(u);
    expect(component.editingId).toBe(u.id);
    expect(component.editModel.username).toBe(u.username);
    component.cancelEdit();
    expect(component.editingId).toBeNull();
  });

  it('saves edit via api.updateUser', () => {
    const u = component.users[0];
    component.startEdit(u);
    component.editModel.username = 'alice2';
    component.editModel.role = 'physician';
    component.saveEdit(u.id);
    expect(apiSpy.updateUser).toHaveBeenCalledWith(u.id, { username: 'alice2', role: 'physician' });
  });

  it('creates a user via api.createUser', () => {
    component.newUser = { username: 'bob', password: 'pw', role: 'physician' } as any;
    component.create();
    expect(apiSpy.createUser).toHaveBeenCalledWith({ username: 'bob', password: 'pw', role: 'physician' });
  });

  it('deletes a user via api.deleteUser', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    component.delete('1');
    expect(apiSpy.deleteUser).toHaveBeenCalledWith('1');
  });
});
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UserManagementComponent } from './user-management.component';
import { ApiService } from '../services/api.service';

describe('UserManagementComponent', () => {
  let fixture: ComponentFixture<UserManagementComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserManagementComponent, HttpClientTestingModule],
      providers: [ApiService]
    }).compileComponents();

    fixture = TestBed.createComponent(UserManagementComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('loads users on init', () => {
    const req = httpMock.expectOne('/api/users');
    req.flush([{ id: '1', username: 'alice', role: 'admin' }]);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('alice');
  });

  it('edits a user and saves', () => {
    // initial load
    const req = httpMock.expectOne('/api/users');
    req.flush([{ id: '1', username: 'alice', role: 'admin' }]);
    fixture.detectChanges();

    // find edit button and simulate click
    const compiled = fixture.nativeElement as HTMLElement;
    const editBtn = compiled.querySelector('button');
    expect(editBtn).toBeTruthy();
    (editBtn as HTMLButtonElement).click();
    fixture.detectChanges();

    // change the username input in the edit form
    const input = compiled.querySelector('input[placeholder="username"]') as HTMLInputElement;
    input.value = 'alice2';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    // expect a PUT when saving
    const saveBtn = compiled.querySelector('button') as HTMLButtonElement;
    (saveBtn).click();
    fixture.detectChanges();

    const putReq = httpMock.expectOne('/api/users/1');
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body.username).toBe('alice2');
    putReq.flush({});
  });
});
