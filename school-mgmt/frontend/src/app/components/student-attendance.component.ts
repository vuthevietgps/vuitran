import { Component, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface AttendanceInfo {
  _id: string;
  studentId: {
    _id: string;
    fullName: string;
    age: number;
    parentName: string;
  };
  classId: {
    _id: string;
    name: string;
    code: string;
  };
  teacherId: {
    _id: string;
    fullName: string;
    email: string;
  };
  date: string;
  status: string;
}

@Component({
  selector: 'app-student-attendance',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="student-attendance-container">
      <div class="attendance-header">
        <h1>Điểm danh học sinh</h1>
      </div>

      <div *ngIf="loading()" class="loading">
        <div class="spinner"></div>
        <p>Đang tải thông tin...</p>
      </div>

      <div *ngIf="error()" class="error-message">
        <h2>❌ {{ error() }}</h2>
        <p>Vui lòng liên hệ giáo viên để được hỗ trợ.</p>
      </div>

      <div *ngIf="!loading() && !error() && !submitted()" class="attendance-content">
        <div class="info-card">
          <h2>Thông tin điểm danh</h2>
          <div class="info-row">
          <span class="label">Học sinh:</span>
          <span class="value">{{ attendanceInfo()?.studentId?.fullName }}</span>
          </div>
          <div class="info-row">
          <span class="label">Lớp:</span>
          <span class="value">{{ attendanceInfo()?.classId?.code }} - {{ attendanceInfo()?.classId?.name }}</span>
          </div>
          <div class="info-row">
          <span class="label">Giáo viên:</span>
          <span class="value">{{ attendanceInfo()?.teacherId?.fullName }}</span>
          </div>
          <div class="info-row">
            <span class="label">Ngày:</span>
            <span class="value">{{ formatDate(attendanceInfo()?.date) }}</span>
          </div>
        </div>

        <div class="webcam-section">
          <h3>Camera</h3>
          <div class="video-container" [class.video-live]="cameraStarted() && !capturedImage()">
            <video #videoElement autoplay playsinline muted></video>
            <canvas #canvasElement style="display: none;"></canvas>

            <div
              *ngIf="cameraStarted() && !capturedImage()"
              class="live-capture-panel"
              data-testid="attendance-live-actions"
            >
              <p class="live-capture-copy">
                Ảnh sẽ được chụp ngay từ khung camera đang mở, không cần thoát ra trước.
              </p>
              <button
                class="btn btn-success live-capture-button"
                data-testid="attendance-capture-button"
                [disabled]="submitting()"
                (click)="captureAndSubmit()"
              >
                {{ submitting() ? 'Đang gửi điểm danh...' : '✅ Điểm danh ngay' }}
              </button>
            </div>
          </div>
          
          <div *ngIf="!cameraStarted()" class="camera-controls">
            <button class="btn btn-primary" data-testid="attendance-start-camera-button" (click)="startCamera()">
              📷 Bật camera
            </button>
          </div>

          <div *ngIf="capturedImage()" class="preview-section">
            <h3>Ảnh đã chụp</h3>
            <img [src]="capturedImage()" alt="Captured" />
            <p class="submitting-text">Đang chụp và gửi điểm danh...</p>
          </div>
        </div>
      </div>

      <div *ngIf="submitted()" class="success-message">
        <div class="success-icon">✅</div>
        <h2>Điểm danh thành công!</h2>
        <p>Cảm ơn bạn đã điểm danh. Thông tin đã được ghi nhận.</p>
        <div class="submitted-info">
          <p><strong>Thời gian:</strong> {{ formatDateTime(submittedAt()) }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .student-attendance-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .attendance-header {
      text-align: center;
      color: white;
      margin-bottom: 2rem;
    }

    .attendance-header h1 {
      font-size: 2.5rem;
      margin: 0;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }

    .loading, .error-message, .success-message {
      background: white;
      padding: 3rem;
      border-radius: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
      max-width: 500px;
      width: 100%;
    }

    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-message {
      background: #fff5f5;
      border: 2px solid #fc8181;
    }

    .error-message h2 {
      color: #c53030;
      margin: 0 0 1rem;
    }

    .attendance-content {
      background: white;
      padding: 2rem;
      border-radius: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      max-width: 800px;
      width: 100%;
    }

    .info-card {
      background: #f7fafc;
      padding: 1.5rem;
      border-radius: 12px;
      margin-bottom: 2rem;
    }

    .info-card h2 {
      margin: 0 0 1rem;
      color: #2d3748;
      font-size: 1.5rem;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid #e2e8f0;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .label {
      font-weight: 600;
      color: #4a5568;
    }

    .value {
      color: #2d3748;
      font-weight: 500;
    }

    .webcam-section {
      text-align: center;
    }

    .webcam-section h3 {
      color: #2d3748;
      margin-bottom: 1rem;
    }

    .video-container {
      position: relative;
      background: #020617;
      border-radius: 16px;
      overflow: hidden;
      margin-bottom: 1.5rem;
      max-width: 640px;
      margin-left: auto;
      margin-right: auto;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.22);
    }

    video {
      width: 100%;
      min-height: 360px;
      height: auto;
      display: block;
      object-fit: cover;
      background: #000;
    }

    .camera-controls {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 1rem;
    }

    .btn {
      padding: 1rem 2rem;
      font-size: 1.125rem;
      font-weight: 600;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0,0,0,0.15);
    }

    .btn:disabled {
      cursor: wait;
      opacity: 0.8;
      transform: none;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-success {
      background: #48bb78;
      color: white;
      font-size: 1.5rem;
      padding: 1.5rem 3rem;
    }

    .live-capture-panel {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 2rem 1rem 1rem;
      background: linear-gradient(180deg, rgba(2, 6, 23, 0) 0%, rgba(2, 6, 23, 0.9) 70%);
    }

    .live-capture-copy {
      margin: 0;
      color: white;
      font-size: 0.95rem;
      line-height: 1.5;
      max-width: 420px;
      text-shadow: 0 1px 3px rgba(0,0,0,0.45);
    }

    .live-capture-button {
      width: min(100%, 320px);
    }

    .preview-section {
      margin-top: 2rem;
    }

    .preview-section img {
      max-width: 100%;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      margin-bottom: 1rem;
    }

    .submitting-text {
      color: #4a5568;
      font-style: italic;
    }

    .success-message {
      background: #f0fff4;
      border: 2px solid #48bb78;
    }

    .success-icon {
      font-size: 5rem;
      margin-bottom: 1rem;
    }

    .success-message h2 {
      color: #2f855a;
      margin: 0 0 1rem;
    }

    .submitted-info {
      margin-top: 1.5rem;
      padding: 1rem;
      background: white;
      border-radius: 8px;
    }

    @media (max-width: 768px) {
      .student-attendance-container {
        padding: 1rem;
      }

      .attendance-header h1 {
        font-size: 2rem;
      }

      .loading, .error-message, .success-message, .attendance-content {
        padding: 1.5rem;
      }

      .info-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.25rem;
      }

      video {
        min-height: 260px;
      }

      .btn-success {
        font-size: 1.125rem;
        padding: 1rem 1.5rem;
      }
    }
  `]
})
export class StudentAttendanceComponent implements OnInit {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  loading = signal(true);
  error = signal('');
  attendanceInfo = signal<AttendanceInfo | null>(null);
  cameraStarted = signal(false);
  capturedImage = signal('');
  submitting = signal(false);
  submitted = signal(false);
  submittedAt = signal<Date | null>(null);

  private token = '';
  private stream: MediaStream | null = null;

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  async ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    
    if (!this.token) {
      this.error.set('Link không hợp lệ');
      this.loading.set(false);
      return;
    }

    await this.loadAttendanceInfo();
  }

  async loadAttendanceInfo() {
    try {
      const data = await firstValueFrom(
        this.http.get<AttendanceInfo>(`${environment.apiBase}/public/attendance/token/${this.token}`),
      );
      this.attendanceInfo.set(data);
      this.loading.set(false);
    } catch (error: any) {
      this.error.set(error?.error?.message || error?.message || 'Có lỗi xảy ra khi tải thông tin');
      this.loading.set(false);
    }
  }

  async startCamera() {
    const video = this.videoElement.nativeElement;
    this.error.set('');
    this.cameraStarted.set(false);
    this.capturedImage.set('');
    this.submitting.set(false);
    this.stopCameraStream();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      });
      
      this.prepareInlineVideo(video);
      video.srcObject = this.stream;
      await video.play();
      await this.waitForVideoReady(video);
      this.cameraStarted.set(true);
    } catch (error) {
      this.stopCameraStream();
      this.cameraStarted.set(false);
      this.error.set('Không thể truy cập camera. Vui lòng cho phép quyền truy cập camera.');
    }
  }

  async captureAndSubmit() {
    if (this.submitting()) {
      return;
    }

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    if (!video.videoWidth || !video.videoHeight) {
      return;
    }

    this.submitting.set(true);
    
    // Giảm kích thước ảnh xuống tối đa 800px width để giảm dung lượng
    const maxWidth = 800;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    
    // Draw video frame to canvas
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Nén ảnh ở mức 50% chất lượng - vừa đủ rõ nét và dung lượng hợp lý
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.5);
      this.capturedImage.set(imageBase64);
      
      // Stop camera
      this.stopCameraStream();
      
      // Submit attendance
      await this.submitAttendance(imageBase64);
      return;
    }

    this.submitting.set(false);
  }

  async submitAttendance(imageBase64: string) {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiBase}/public/attendance/submit`, {
          token: this.token,
          imageBase64,
        }),
      );
      this.submitted.set(true);
      this.submittedAt.set(new Date());
    } catch (error: any) {
      this.error.set(error?.error?.message || error?.message || 'Có lỗi xảy ra khi gửi điểm danh');
      this.capturedImage.set(''); // Reset to allow retry
      this.cameraStarted.set(false);
    } finally {
      this.submitting.set(false);
    }
  }

  formatDate(dateStr: any): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  formatDateTime(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  ngOnDestroy() {
    this.stopCameraStream();
  }

  private prepareInlineVideo(video: HTMLVideoElement) {
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('autoplay', 'true');
    video.setAttribute('muted', 'true');
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
  }

  private async waitForVideoReady(video: HTMLVideoElement) {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    await new Promise<void>(resolve => {
      const timeoutId = window.setTimeout(() => resolve(), 800);
      const handleLoadedData = () => {
        window.clearTimeout(timeoutId);
        resolve();
      };

      video.addEventListener('loadeddata', handleLoadedData, { once: true });
    });
  }

  private stopCameraStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
}
