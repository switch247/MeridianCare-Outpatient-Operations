import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-kiosk-page',
  standalone: true,
  imports: [CommonModule],
  template: `<section class="panel"><h2>Kiosk Mode</h2><p>Read-only kiosk interface.</p></section>`
})
export class KioskPageComponent {}
