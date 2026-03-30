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
