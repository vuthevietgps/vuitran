import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { StudentAttendanceComponent } from './student-attendance.component';

describe('StudentAttendanceComponent', () => {
  let fixture: ComponentFixture<StudentAttendanceComponent>;
  let component: StudentAttendanceComponent;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  const attendanceInfo = {
    _id: 'attendance-1',
    studentId: {
      _id: 'student-1',
      fullName: 'Hoc sinh demo',
      age: 10,
      parentName: 'Phu huynh demo',
    },
    classId: {
      _id: 'class-1',
      name: 'Lop Demo',
      code: 'CLS-001',
    },
    teacherId: {
      _id: 'teacher-1',
      fullName: 'Giao vien demo',
      email: 'teacher@example.com',
    },
    date: '2026-04-13T00:00:00.000Z',
    status: 'PENDING',
  };

  beforeEach(async () => {
    httpSpy = jasmine.createSpyObj<HttpClient>('HttpClient', ['get', 'post']);
    httpSpy.get.and.returnValue(of(attendanceInfo));
    httpSpy.post.and.returnValue(of({ ok: true }));

    await TestBed.configureTestingModule({
      imports: [StudentAttendanceComponent],
      providers: [
        { provide: HttpClient, useValue: httpSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ token: 'token-1' }),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StudentAttendanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('shows the live capture button as soon as the camera is active', () => {
    component.cameraStarted.set(true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="attendance-start-camera-button"]'),
    ).toBeFalsy();
    expect(
      fixture.nativeElement.querySelector('[data-testid="attendance-capture-button"]'),
    ).toBeTruthy();
  });

  it('starts the camera inline and keeps the capture action visible', async () => {
    const fakeStream = {
      getTracks: () => [],
    } as unknown as MediaStream;
    const getUserMedia = jasmine.createSpy('getUserMedia').and.resolveTo(fakeStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    const video = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
    let assignedStream: unknown = null;
    Object.defineProperty(video, 'srcObject', {
      configurable: true,
      get: () => assignedStream,
      set: (value: unknown) => {
        assignedStream = value;
      },
    });
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      value: HTMLMediaElement.HAVE_CURRENT_DATA,
    });
    spyOn(video, 'play').and.returnValue(Promise.resolve());

    await component.startCamera();
    fixture.detectChanges();

    expect(getUserMedia).toHaveBeenCalled();
    expect(video.srcObject).toBe(fakeStream);
    expect(video.muted).toBeTrue();
    expect(video.playsInline).toBeTrue();
    expect(video.getAttribute('playsinline')).toBe('true');
    expect(video.getAttribute('webkit-playsinline')).toBe('true');
    expect(component.cameraStarted()).toBeTrue();
    expect(
      fixture.nativeElement.querySelector('[data-testid="attendance-capture-button"]'),
    ).toBeTruthy();
  });

  it('captures the live frame and submits attendance immediately', async () => {
    const stopTrack = jasmine.createSpy('stopTrack');
    const video = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    component.cameraStarted.set(true);
    (component as any).stream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;

    Object.defineProperty(video, 'videoWidth', { configurable: true, value: 1280 });
    Object.defineProperty(video, 'videoHeight', { configurable: true, value: 720 });

    const drawImage = jasmine.createSpy('drawImage');
    spyOn(canvas, 'getContext').and.returnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    spyOn(canvas, 'toDataURL').and.returnValue('data:image/jpeg;base64,captured');

    await component.captureAndSubmit();

    expect(drawImage).toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalled();
    expect(httpSpy.post).toHaveBeenCalledWith(
      jasmine.stringMatching(/\/public\/attendance\/submit$/),
      {
        token: 'token-1',
        imageBase64: 'data:image/jpeg;base64,captured',
      },
    );
    expect(component.capturedImage()).toBe('data:image/jpeg;base64,captured');
    expect(component.submitted()).toBeTrue();
  });
});
