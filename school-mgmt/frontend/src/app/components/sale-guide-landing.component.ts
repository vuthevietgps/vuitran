import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

interface WorkflowStep {
  step: string;
  title: string;
  summary: string;
  checklist: string[];
  note: string;
  image: string;
  route?: string;
  queryParams?: Record<string, string>;
  allowedRoles?: Role[];
}

interface QuickLink {
  title: string;
  description: string;
  route: string;
  queryParams?: Record<string, string>;
  roleScope: Role[];
}

interface GalleryItem {
  title: string;
  description: string;
  image: string;
  route?: string;
  queryParams?: Record<string, string>;
  roleScope: Role[];
}

interface ResourceCard {
  title: string;
  description: string;
  route: string;
  queryParams?: Record<string, string>;
  kind: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

const INTERNAL_IMAGE_BASE = '/assets/internal-handbook/images';
const INTERNAL_VIDEO_BASE = '/assets/internal-handbook/videos';

const saleImage = (name: string) => `${INTERNAL_IMAGE_BASE}/${name}.webp`;
const saleVideo = (name: string) => `${INTERNAL_VIDEO_BASE}/${name}.webm`;

@Component({
  selector: 'app-sale-guide-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="sale-hub">
      <section class="hero-card">
        <div class="hero-copy">
          <p class="eyebrow">Internal Sale Hub</p>
          <h1>Huong dan sale theo dung 5 buoc van hanh</h1>
          <p class="hero-text">
            Trang nay gom mot luong dung cho sale moi: tu phoi hop tao phu huynh, gan hoc sinh,
            lap hoa don, cho duyet hoac nap tien, roi moi sang buoc tao lop. Toan bo anh, text va video
            duoc dat chung de onboarding nhanh hon va de kiem tra cheo hon. Sale duoc tao va sua tai khoan
            phu huynh trong danh muc minh phu trach, khong duoc xoa, con Director van giu quyen chuyen owner.
          </p>

          <div class="hero-actions">
            <a class="btn btn-primary" href="#workflow">Xem 5 buoc chuan</a>
            <a
              class="btn btn-secondary"
              [routerLink]="parentAccountsRoute"
              [queryParams]="parentAccountsQueryParams">
              Mo man hinh phu huynh
            </a>
            <a class="btn btn-ghost" [href]="videoSrc" target="_blank" rel="noopener">Xem video thao tac</a>
          </div>

          <div class="hero-meta">
            <article class="meta-card">
              <span class="meta-label">Diem can nho</span>
              <strong>Chi tao lop sau khi hoa don duyet hoac phu huynh co du so du</strong>
            </article>
            <article class="meta-card">
              <span class="meta-label">Dau vao chinh</span>
              <strong>Phu huynh -> hoc sinh -> hoa don -> phe duyet -> lop</strong>
            </article>
            <article class="meta-card">
              <span class="meta-label">Quyen hien tai</span>
              <strong>Sale duoc tao/sua parent, Director duoc chuyen owner, sale khong duoc xoa</strong>
            </article>
          </div>
        </div>

        <div class="hero-visual">
          <img [src]="heroImage" alt="Tong quan sale hub" loading="eager" />
        </div>
      </section>

      <section class="section section-band">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Diem gat tu dong</p>
            <h2>Chot dung thoi diem truoc khi tao lop</h2>
          </div>
        </div>

        <div class="gate-grid">
          <article class="gate-card gold">
            <h3>1. Hoa don duoc phe duyet</h3>
            <p>
              Neu hoa don da sang trang thai approved, sale co the chuan bi buoc tao lop ngay.
            </p>
          </article>
          <article class="gate-card teal">
            <h3>2. Phu huynh da nap tien</h3>
            <p>
              Neu tai khoan phu huynh da co so du, co the xu ly buoc lap lop ma khong phai doi them.
            </p>
          </article>
          <article class="gate-card ember">
            <h3>3. Chua du mot trong hai dieu kien</h3>
            <p>
              Tam dung buoc tao lop, giu lai ghi chu va ban giao cho nguoi phu trach duyet hoac nap tien.
            </p>
          </article>
        </div>
      </section>

      <section class="section" id="workflow">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Luong chuan</p>
            <h2>5 buoc sale phai nam rat ro</h2>
            <p class="section-summary">
              Day la luong can truyen dat cho sale moi: lam dung thu tu, dung nguoi, dung trang thai.
            </p>
          </div>
        </div>

        <div class="workflow-grid">
          <article class="workflow-card" *ngFor="let step of workflowSteps" [attr.data-step]="step.step">
            <div class="workflow-head">
              <div>
                <span class="step-pill">Buoc {{ step.step }}</span>
                <h3>{{ step.title }}</h3>
              </div>
              <a
                class="route-pill"
                *ngIf="step.route && canOpenRoute(step.allowedRoles || [])"
                [routerLink]="step.route"
                [queryParams]="step.queryParams">
                Mo man hinh
              </a>
            </div>
            <p class="workflow-summary">{{ step.summary }}</p>
            <img [src]="step.image" [alt]="step.title" loading="lazy" class="workflow-image" />
            <ul>
              <li *ngFor="let item of step.checklist">{{ item }}</li>
            </ul>
            <div class="workflow-note">{{ step.note }}</div>
          </article>
        </div>
      </section>

      <section class="section">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Quick links</p>
            <h2>Man hinh can mo lien tuc trong ngay</h2>
          </div>
        </div>

        <div class="resource-grid">
          <a class="resource-card" *ngFor="let link of quickLinks" [routerLink]="link.route" [queryParams]="link.queryParams">
            <span class="resource-kind">{{ link.title }}</span>
            <h3>{{ link.description }}</h3>
            <code>{{ link.route }}</code>
          </a>
        </div>
      </section>

      <section class="section">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Gallery</p>
            <h2>Anh minh hoa cho tung moc trong flow</h2>
          </div>
        </div>

        <div class="gallery-grid">
          <article class="gallery-card" *ngFor="let item of galleryItems">
            <img [src]="item.image" [alt]="item.title" loading="lazy" />
            <div class="gallery-copy">
              <h3>{{ item.title }}</h3>
              <p>{{ item.description }}</p>
              <div class="gallery-actions">
                <a class="text-link" [href]="item.image" target="_blank" rel="noopener">Mo anh</a>
                <a
                  class="text-link"
                  *ngIf="item.route && canOpenRoute(item.roleScope)"
                  [routerLink]="item.route"
                  [queryParams]="item.queryParams">
                  Mo man hinh
                </a>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="section">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Video thao tac</p>
            <h2>Video dong bo voi huong dan tai mat</h2>
          </div>
        </div>

        <div class="video-grid">
          <article class="video-card">
            <video controls preload="metadata" [poster]="heroImage">
              <source [src]="videoSrc" type="video/webm" />
            </video>
            <div class="video-copy">
              <h3>Video sale daily flow</h3>
              <p>
                Xem noi dung minh hoa luong lam viec mau: tu phoi hop phu huynh den tao hoc sinh,
                lap hoa don va tao lop khi du dieu kien.
              </p>
              <a class="text-link" [href]="videoSrc" target="_blank" rel="noopener">Mo video rieng</a>
            </div>
          </article>
        </div>
      </section>

      <section class="section dual-layout">
        <div class="panel">
          <p class="section-kicker">Tai lieu phu tro</p>
          <h2>Cac man hinh can doi chieu trong phien lam viec sale</h2>
          <div class="resource-grid compact">
            <a
              class="resource-card"
              *ngFor="let resource of resources"
              [routerLink]="resource.route"
              [queryParams]="resource.queryParams">
              <span class="resource-kind">{{ resource.kind }}</span>
              <h3>{{ resource.title }}</h3>
              <p>{{ resource.description }}</p>
              <code>{{ resource.route }}</code>
            </a>
          </div>
        </div>

        <div class="panel">
          <p class="section-kicker">Hoi dap nhanh</p>
          <h2>Cac cau hoi sale hay gap khi onboarding</h2>
          <div class="faq-list">
            <article class="faq-card" *ngFor="let item of faqs">
              <h3>{{ item.question }}</h3>
              <p>{{ item.answer }}</p>
            </article>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100%;
      padding: 28px;
      background:
        radial-gradient(circle at top right, rgba(249, 115, 22, 0.14), transparent 18%),
        radial-gradient(circle at left center, rgba(20, 184, 166, 0.14), transparent 20%),
        linear-gradient(180deg, #f5efe5 0%, #f8f3eb 34%, #fcfbf7 100%);
      color: #14213d;
      font-family: 'Trebuchet MS', 'Aptos', 'Segoe UI', sans-serif;
    }

    .sale-hub {
      display: grid;
      gap: 24px;
      max-width: 1480px;
      margin: 0 auto;
      animation: page-enter 420ms ease-out;
    }

    .hero-card,
    .section,
    .workflow-card,
    .gate-card,
    .resource-card,
    .gallery-card,
    .video-card,
    .panel,
    .faq-card {
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
    }

    .hero-card,
    .section {
      border: 1px solid rgba(20, 33, 61, 0.08);
      border-radius: 32px;
      background: rgba(255, 252, 247, 0.88);
      backdrop-filter: blur(12px);
    }

    .hero-card {
      display: grid;
      grid-template-columns: minmax(0, 1.18fr) minmax(340px, 0.82fr);
      gap: 24px;
      padding: 30px;
      overflow: hidden;
    }

    .hero-copy {
      display: grid;
      gap: 16px;
      align-content: start;
    }

    .eyebrow,
    .section-kicker,
    .meta-label,
    .resource-kind,
    .step-pill {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 8px 12px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 11px;
      font-weight: 800;
    }

    .eyebrow,
    .section-kicker,
    .resource-kind,
    .step-pill {
      background: rgba(20, 184, 166, 0.12);
      color: #0f766e;
    }

    h1, h2, h3 {
      margin: 0;
      font-family: 'Aptos Display', 'Trebuchet MS', 'Segoe UI', sans-serif;
      letter-spacing: -0.03em;
    }

    h1 {
      font-size: clamp(34px, 5vw, 58px);
      line-height: 1.02;
    }

    h2 {
      font-size: clamp(28px, 3.4vw, 40px);
      line-height: 1.08;
    }

    h3 {
      font-size: 22px;
      line-height: 1.15;
    }

    .hero-text,
    .section-summary,
    .workflow-summary,
    .workflow-note,
    .gate-card p,
    .gallery-copy p,
    .video-copy p,
    .faq-card p,
    .resource-card p {
      margin: 0;
      color: #475569;
      line-height: 1.65;
      font-size: 15px;
    }

    .hero-actions,
    .gallery-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 999px;
      border: 1px solid transparent;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      transition: transform 180ms ease, box-shadow 180ms ease;
    }

    .btn:hover {
      transform: translateY(-1px);
    }

    .btn-primary {
      background: linear-gradient(135deg, #0f766e 0%, #115e59 100%);
      color: #f8fafc;
      box-shadow: 0 12px 28px rgba(15, 118, 110, 0.22);
    }

    .btn-secondary {
      background: #fff7ed;
      border-color: rgba(217, 119, 6, 0.18);
      color: #9a3412;
    }

    .btn-ghost {
      background: transparent;
      border-color: rgba(20, 33, 61, 0.14);
      color: #14213d;
    }

    .hero-meta {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .meta-card {
      border-radius: 22px;
      padding: 18px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(249, 250, 251, 0.92) 100%);
      border: 1px solid rgba(20, 33, 61, 0.08);
      display: grid;
      gap: 10px;
    }

    .meta-card strong {
      font-size: 18px;
      color: #14213d;
      line-height: 1.4;
    }

    .hero-visual {
      position: relative;
      display: flex;
      min-height: 100%;
    }

    .hero-visual::before {
      content: '';
      position: absolute;
      inset: 18px 0 0 18px;
      border-radius: 28px;
      background: linear-gradient(145deg, rgba(217, 119, 6, 0.16), rgba(20, 184, 166, 0.16));
      filter: blur(6px);
    }

    .hero-visual img,
    .workflow-image,
    .gallery-card img,
    .video-card video {
      display: block;
      width: 100%;
    }

    .hero-visual img {
      position: relative;
      object-fit: cover;
      min-height: 100%;
      border-radius: 28px;
      border: 1px solid rgba(255, 255, 255, 0.74);
    }

    .section {
      padding: 26px;
      display: grid;
      gap: 18px;
      animation: section-rise 420ms ease both;
    }

    .section-heading {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
    }

    .section-band {
      background: linear-gradient(180deg, rgba(255, 247, 237, 0.8) 0%, rgba(255, 255, 255, 0.96) 100%);
    }

    .gate-grid,
    .workflow-grid,
    .resource-grid,
    .gallery-grid,
    .video-grid,
    .faq-list {
      display: grid;
      gap: 16px;
    }

    .gate-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .gate-card {
      padding: 20px;
      border-radius: 24px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      display: grid;
      gap: 10px;
    }

    .gate-card.gold { background: linear-gradient(180deg, #fff9ed 0%, #fffef8 100%); }
    .gate-card.teal { background: linear-gradient(180deg, #ecfdf5 0%, #f8fffc 100%); }
    .gate-card.ember { background: linear-gradient(180deg, #fff7ed 0%, #fffaf5 100%); }

    .workflow-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .workflow-card {
      padding: 22px;
      display: grid;
      gap: 12px;
      border-radius: 24px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: linear-gradient(180deg, rgba(255, 247, 237, 0.94) 0%, rgba(255, 255, 255, 0.96) 100%);
    }

    .workflow-card[data-step='01'] { background: linear-gradient(180deg, rgba(255, 251, 235, 0.96) 0%, rgba(255, 255, 255, 0.98) 100%); }
    .workflow-card[data-step='02'] { background: linear-gradient(180deg, rgba(236, 253, 245, 0.96) 0%, rgba(255, 255, 255, 0.98) 100%); }
    .workflow-card[data-step='03'] { background: linear-gradient(180deg, rgba(255, 247, 237, 0.96) 0%, rgba(255, 255, 255, 0.98) 100%); }
    .workflow-card[data-step='04'] { background: linear-gradient(180deg, rgba(239, 246, 255, 0.96) 0%, rgba(255, 255, 255, 0.98) 100%); }
    .workflow-card[data-step='05'] { background: linear-gradient(180deg, rgba(250, 250, 250, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%); }

    .workflow-head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 10px;
    }

    .route-pill {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 6px 10px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #475569;
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .workflow-image {
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 18px;
      border: 1px solid rgba(20, 33, 61, 0.08);
    }

    ul {
      margin: 0;
      padding-left: 20px;
      display: grid;
      gap: 8px;
      color: #334155;
      line-height: 1.58;
      font-size: 14px;
    }

    li::marker {
      color: #d97706;
    }

    .workflow-note {
      border-radius: 18px;
      padding: 14px;
      background: rgba(15, 118, 110, 0.08);
      color: #0f766e;
      font-weight: 700;
    }

    .resource-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .resource-grid.compact {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .resource-card {
      display: grid;
      gap: 10px;
      padding: 18px;
      border-radius: 24px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: rgba(255, 255, 255, 0.94);
      text-decoration: none;
      color: inherit;
      transition: transform 180ms ease, box-shadow 180ms ease;
    }

    .resource-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 54px rgba(15, 23, 42, 0.1);
    }

    .resource-card code {
      width: fit-content;
      border-radius: 999px;
      background: #f1f5f9;
      padding: 6px 10px;
      color: #475569;
      font-size: 12px;
      font-weight: 700;
    }

    .gallery-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .gallery-card {
      border-radius: 24px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      overflow: hidden;
      background: rgba(255, 255, 255, 0.95);
      display: grid;
      grid-template-rows: 200px auto;
    }

    .gallery-card img {
      height: 100%;
      object-fit: cover;
    }

    .gallery-copy {
      padding: 18px;
      display: grid;
      gap: 10px;
    }

    .video-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .video-card {
      border-radius: 24px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      overflow: hidden;
      background: rgba(255, 255, 255, 0.95);
    }

    .video-card video {
      aspect-ratio: 16 / 10;
      background: #0f172a;
    }

    .video-copy,
    .faq-card {
      padding: 18px;
    }

    .faq-card {
      border-radius: 20px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: rgba(255, 255, 255, 0.95);
      display: grid;
      gap: 8px;
    }

    .text-link {
      color: #0f766e;
      text-decoration: none;
      font-weight: 700;
    }

    .text-link:hover {
      color: #115e59;
      text-decoration: underline;
    }

    .dual-layout {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .panel {
      padding: 22px;
      display: grid;
      gap: 14px;
      border-radius: 24px;
      border: 1px solid rgba(20, 33, 61, 0.08);
      background: rgba(255, 255, 255, 0.95);
    }

    @keyframes page-enter {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes section-rise {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 1320px) {
      .hero-card,
      .gate-grid,
      .workflow-grid,
      .gallery-grid,
      .resource-grid,
      .dual-layout {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 900px) {
      :host {
        padding: 16px;
      }

      .hero-card,
      .section {
        padding: 18px;
        border-radius: 24px;
      }

      .hero-meta,
      .resource-grid.compact {
        grid-template-columns: 1fr;
      }

      .section-heading,
      .workflow-head {
        flex-direction: column;
        align-items: start;
      }

      .gallery-card {
        grid-template-rows: 180px auto;
      }
    }
  `],
})
export class SaleGuideLandingComponent {
  private readonly auth = inject(AuthService);

  protected readonly currentRole = computed(
    () => (this.auth.userSignal()?.role as Role | undefined) || undefined,
  );

  protected readonly parentAccountsRoute = '/app/users';
  protected readonly parentAccountsQueryParams = { role: 'PARENT' };
  protected readonly heroImage = saleImage('sale_overview');
  protected readonly videoSrc = saleVideo('sale_daily_flow');

  protected readonly workflowSteps: WorkflowStep[] = [
    {
      step: '01',
      title: 'Tao phu huynh',
      summary: 'Sale tao tai khoan phu huynh, ghi du thong tin nguoi bao ho va dong owner sale ngay tu luc tao.',
      checklist: [
        'Nhap ma PH, email, so dien thoai, ho ten, dia chi va link Facebook neu co.',
        'Tai khoan parent do sale tao se gan owner la chinh sale do; sale duoc sua nhung khong duoc xoa.',
        'Khi can chuyen parent sang sale khac, sale ghi chu va nhan Director thao tac chuyen owner.',
      ],
      note: 'Muc tieu: co parent record sach, dung owner, dung thong tin lien he ngay tu lan dau.',
      image: saleImage('sale_overview'),
      route: '/app/users',
      queryParams: { role: 'PARENT' },
      allowedRoles: [Role.DIRECTOR, Role.SALE],
    },
    {
      step: '02',
      title: 'Tao hoc sinh gan vao phu huynh',
      summary: 'Them hoc sinh va lien ket dung vao parent account vua tao de du lieu khong bi roi owner.',
      checklist: [
        'Nhap ma hoc sinh, tuoi, ten va thong tin cha/mẹ.',
        'Kiem tra parentUserId truoc khi luu de chac chan hoc sinh gan dung parent account.',
        'Ra soat sale phu trach trong hoc sinh de khop voi owner cua parent sau nay.',
      ],
      note: 'Buoc nay giup sale co mot record hoc sinh ro rang truoc khi lap hoa don.',
      image: saleImage('sale_leads'),
      route: '/app/students',
      allowedRoles: [Role.DIRECTOR, Role.OPS, Role.SALE, Role.ACCOUNTING],
    },
    {
      step: '03',
      title: 'Tao hoa don va cho duyet',
      summary: 'Lap hoa don dung goi, dung so tien va de trang thai cho duyet truoc khi mo buoc tao lop.',
      checklist: [
        'Kiem tra goi san pham, so buoi va tong tien.',
        'Nhap dung trang thai pending approval de doi bo phan phe duyet va doi soat.',
        'Chup nhanh thong tin de ban giao neu can Director, OPS hoac Accounting ho tro.',
      ],
      note: 'Day la moc can phoi hop voi Director hoac Accounting neu can xac nhan.',
      image: saleImage('sale_orders'),
      route: '/app/invoices',
      allowedRoles: [Role.DIRECTOR, Role.OPS, Role.SALE, Role.ACCOUNTING],
    },
    {
      step: '04',
      title: 'Chi tao lop khi duoc phe duyet hoac da co so du',
      summary: 'Neu hoa don da approved hoac phu huynh da nap tien, moi chuyen sang buoc lap lop.',
      checklist: [
        'Doc lai trang thai hoa don truoc khi mo man hinh lop.',
        'Neu phu huynh da co so du, doi chieu lai so tien va dien giai trong vi truoc khi tiep tuc.',
        'Neu chua du dieu kien, dung tai day va ban giao tiep cho nguoi xu ly tai chinh.',
      ],
      note: 'Diem an toan: khong tao lop khi hoa don con pending va phu huynh chua co tien.',
      image: saleImage('parent_wallets'),
      route: '/app/invoices',
      allowedRoles: [Role.DIRECTOR, Role.OPS, Role.SALE, Role.ACCOUNTING],
    },
    {
      step: '05',
      title: 'Tao lop',
      summary: 'Tao class sau khi qua gate tai chinh, gan hoc sinh, chon giao vien va chot thong tin van hanh.',
      checklist: [
        'Kiem tra hoc sinh da co du thong tin va hoa don hop le.',
        'Gan giao vien, ca hoc va thong so lop can thiet.',
        'Doi chieu lai sale phu trach, parent owner va thong tin hoc sinh truoc khi luu lop.',
      ],
      note: 'Diem ket thuc flow: lop duoc tao khi tat ca dau vao da san sang.',
      image: saleImage('ops_classes'),
      route: '/app/classes',
      allowedRoles: [Role.DIRECTOR, Role.OPS, Role.SALE],
    },
  ];

  protected readonly quickLinks: QuickLink[] = [
    {
      title: 'Parent accounts',
      description: 'Buoc 1 cua flow: tao, sua va tim parent account theo owner sale.',
      route: '/app/users',
      queryParams: { role: 'PARENT' },
      roleScope: [Role.DIRECTOR, Role.SALE],
    },
    {
      title: 'Students',
      description: 'Mo man hinh hoc sinh de gan parent va theo doi thong tin dau vao.',
      route: '/app/students',
      roleScope: [Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.SALE],
    },
    {
      title: 'Invoices',
      description: 'Lap, kiem tra va doi trang thai hoa don truoc khi tao lop.',
      route: '/app/invoices',
      roleScope: [Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.SALE],
    },
    {
      title: 'Classes',
      description: 'Diem bat dau khi duoc phe duyet hoac da co so du phu huynh.',
      route: '/app/classes',
      roleScope: [Role.DIRECTOR, Role.OPS, Role.SALE],
    },
    {
      title: 'Leads',
      description: 'Noi tiep nhan lead de ban giao sang buoc tao phu huynh.',
      route: '/app/leads',
      roleScope: [Role.DIRECTOR, Role.OPS, Role.SALE],
    },
    {
      title: 'Landing pages',
      description: 'Kiem tra nguon lead tu landing page va cac du lieu submit.',
      route: '/app/landing-pages',
      roleScope: [Role.DIRECTOR, Role.OPS, Role.SALE],
    },
    {
      title: 'Commission report',
      description: 'Doi chieu hoa don da chot voi doanh thu va hoa hong.',
      route: '/app/commission-report',
      roleScope: [Role.DIRECTOR, Role.ACCOUNTING, Role.SALE],
    },
  ];

  protected readonly galleryItems: GalleryItem[] = [
    {
      title: 'Tong quan sale hub',
      description: 'Anh mo dau de sale moi nhin ngay luong chung va nhan pham vi cong viec.',
      image: saleImage('sale_overview'),
      roleScope: [Role.DIRECTOR, Role.OPS, Role.SALE],
    },
    {
      title: 'Dashboard sale',
      description: 'Khu vuc mo dau ngay, doc dashboard de biet lead nao can xu ly truoc.',
      image: saleImage('sale_dashboard'),
      route: '/app/dashboard',
      roleScope: [Role.DIRECTOR, Role.OPS, Role.SALE],
    },
    {
      title: 'Lead intake',
      description: 'Man hinh xu ly lead de ban giao sang buoc tao phu huynh va hoc sinh.',
      image: saleImage('sale_leads'),
      route: '/app/leads',
      roleScope: [Role.DIRECTOR, Role.OPS, Role.SALE],
    },
    {
      title: 'Hoa don va order',
      description: 'Khu vuc mo de theo doi trang thai lap hoa don va gia tri can cho duyet.',
      image: saleImage('sale_orders'),
      route: '/app/invoices',
      roleScope: [Role.DIRECTOR, Role.OPS, Role.SALE, Role.ACCOUNTING],
    },
    {
      title: 'So du phu huynh',
      description: 'Anh minh hoa cho buoc doi soat so du truoc khi chuyen sang lap lop.',
      image: saleImage('parent_wallets'),
      route: '/app/wallets',
      roleScope: [Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.PARENT],
    },
  ];

  protected readonly resources: ResourceCard[] = [
    {
      title: 'Parent accounts',
      description: 'Noi sale tao va sua parent account trong pham vi phu trach.',
      route: '/app/users',
      queryParams: { role: 'PARENT' },
      kind: 'Action',
    },
    {
      title: 'Leads',
      description: 'Kiem tra lead vao va ban giao dung nguoi phu trach.',
      route: '/app/leads',
      kind: 'Action',
    },
    {
      title: 'Students',
      description: 'Gan hoc sinh vao phu huynh, giu day du thong tin.',
      route: '/app/students',
      kind: 'Action',
    },
    {
      title: 'Invoices',
      description: 'Lap hoa don, doi trang thai pending va approved.',
      route: '/app/invoices',
      kind: 'Action',
    },
    {
      title: 'Classes',
      description: 'Chi mo khi da duyet hoac phu huynh da co so du.',
      route: '/app/classes',
      kind: 'Action',
    },
    {
      title: 'Landing pages',
      description: 'Doi chieu nguon lead va du lieu submit tu landing page.',
      route: '/app/landing-pages',
      kind: 'Source',
    },
    {
      title: 'Commission report',
      description: 'Doi soat doanh so, hoa hong va ket qua chot don.',
      route: '/app/commission-report',
      kind: 'Review',
    },
  ];

  protected readonly faqs: FAQItem[] = [
    {
      question: 'Buoc nao la diem dung quan trong nhat?',
      answer: 'Buoc 4. Neu hoa don chua approved va phu huynh chua co so du, khong nen sang buoc tao lop.',
    },
    {
      question: 'Sale hien tai duoc thao tac gi tren parent account?',
      answer: 'Sale duoc tao va sua parent account trong danh muc minh phu trach, nhung khong duoc xoa parent account.',
    },
    {
      question: 'Tai sao phai gan hoc sinh vao phu huynh truoc hoa don?',
      answer: 'De bao dam du lieu khong bi roi, de hoa don va class ve sau co the truy nguon dung parent.',
    },
    {
      question: 'Ai duoc chuyen parent sang sale khac?',
      answer: 'Director van giu quyen doi sale owner cho parent. Khi doi owner, can doi chieu lai hoc sinh dang gan parent do.',
    },
  ];

  protected canOpenRoute(allowedRoles: Role[]): boolean {
    const currentRole = this.currentRole();
    return !!currentRole && allowedRoles.includes(currentRole);
  }
}
