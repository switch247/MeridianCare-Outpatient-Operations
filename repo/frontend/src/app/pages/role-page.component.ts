import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-role-page',
  standalone: true,
  template: `<section class="panel"><h2>{{title}}</h2><ul><li *ngFor="let step of steps">{{step}}</li></ul></section>`,
})
export class RolePageComponent {
  @Input() title = '';
  @Input() steps: string[] = [];
}
