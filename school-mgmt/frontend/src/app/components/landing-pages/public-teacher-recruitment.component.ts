import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TeacherRegistrationService } from '../../services/teacher-registration.service';

@Component({
  selector: 'app-public-teacher-recruitment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './public-teacher-recruitment.component.html',
  styleUrls: ['./public-teacher-recruitment.component.css'],
})
export class PublicTeacherRecruitmentComponent {
  readonly submitting = signal(false);
  readonly submitError = signal('');
  readonly submitSuccess = signal(false);
  readonly applicationCode = signal('');
  readonly selectedImage = signal<{
    src: string;
    alt: string;
    caption: string;
  } | null>(null);

  readonly form = {
    fullName: '',
    phone: '',
    email: '',
    subjects: '',
    grades: '',
    teachingMode: 'BOTH' as 'ONLINE' | 'OFFLINE' | 'BOTH',
    locations: '',
    yearsOfExperience: 0,
    bio: '',
  };

  constructor(
    private readonly teacherRegistrationService: TeacherRegistrationService,
  ) {}

  private parseCommaList(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  openImage(src: string, alt: string, caption: string): void {
    this.selectedImage.set({ src, alt, caption });
  }

  closeImage(): void {
    this.selectedImage.set(null);
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;

    this.submitting.set(true);
    this.submitError.set('');

    try {
      const result = await this.teacherRegistrationService.submitPublic({
        fullName: this.form.fullName.trim(),
        phone: this.form.phone.trim(),
        email: this.form.email.trim() || undefined,
        subjects: this.parseCommaList(this.form.subjects),
        grades: this.parseCommaList(this.form.grades),
        teachingMode: this.form.teachingMode,
        locations: this.parseCommaList(this.form.locations),
        yearsOfExperience: Number(this.form.yearsOfExperience || 0),
        bio: this.form.bio.trim() || undefined,
        sourcePage: 'tuyen-dung-giao-vien',
      });

      this.applicationCode.set(result.applicationCode);
      this.submitSuccess.set(true);
    } catch (error: any) {
      this.submitError.set(
        error?.error?.message || 'Không gửi được thông tin. Vui lòng thử lại.',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
