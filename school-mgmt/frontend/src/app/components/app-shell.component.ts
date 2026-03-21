import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  RouteConfigLoadEnd,
  RouteConfigLoadStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NotificationsService } from '../services/notifications.service';
import { PendingApprovalsService } from '../services/pending-approvals.service';
import { RoutePrefetchService } from '../services/route-prefetch.service';
import { Role, ROLE_LABELS } from '../models/role.enum';

const SIDEBAR_STATE_STORAGE_KEY = 'school_mgmt_sidebar_collapsed';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
  <div class="layout" [class.collapsed]="sidebarCollapsed">
    <aside class="sidebar" [class.collapsed]="sidebarCollapsed">
      <button type="button" class="toggle" (click)="toggleSidebar()">{{ sidebarCollapsed ? '&#9776;' : '&laquo;' }}</button>
      <h3 *ngIf="!sidebarCollapsed">Chức năng</h3>
      <nav>
        <div class="menu-group" [class.open]="menuGroups['overview']">
          <button class="menu-group-header" (click)="toggleGroup('overview')" *ngIf="!sidebarCollapsed">
            <span class="group-icon">&#9632;</span>
            <span class="group-label">Tổng quan</span>
            <span class="group-arrow">{{ menuGroups['overview'] ? '&#9650;' : '&#9660;' }}</span>
          </button>
          <div class="menu-group-items" [class.collapsed-sidebar]="sidebarCollapsed">
            <a routerLink="/app/dashboard" routerLinkActive="active" title="Dashboard">
              <span class="icon">&#9632;</span><span class="label">Dashboard</span>
            </a>
            <a [routerLink]="getHandbookRoute()" routerLinkActive="active" [attr.title]="getHandbookLabel()">
              <span class="icon">&#128214;</span><span class="label">{{ getHandbookLabel() }}</span>
            </a>
            <a routerLink="/app/pending-approvals" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR])" title="Chờ duyệt">
              <span class="icon">&#128203;</span><span class="label">Chờ duyệt</span>
              <span class="nav-badge" *ngIf="pendingCount > 0">{{ pendingCount }}</span>
            </a>
            <a routerLink="/app/notifications" routerLinkActive="active" title="Thông báo">
              <span class="icon">&#128276;</span><span class="label">Thông báo</span>
              <span class="nav-badge" *ngIf="unreadNotifCount > 0">{{ unreadNotifCount }}</span>
            </a>
          </div>
        </div>

        <div class="menu-group" [class.open]="menuGroups['management']" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.SALE, Role.TEACHER])">
          <button class="menu-group-header" (click)="toggleGroup('management')" *ngIf="!sidebarCollapsed">
            <span class="group-icon">&#128736;</span>
            <span class="group-label">Quản lý</span>
            <span class="group-arrow">{{ menuGroups['management'] ? '&#9650;' : '&#9660;' }}</span>
          </button>
          <div class="menu-group-items" [class.collapsed-sidebar]="sidebarCollapsed">
            <a
              routerLink="/app/users"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ paths: 'exact', queryParams: 'exact', matrixParams: 'ignored', fragment: 'ignored' }"
              *ngIf="hasRole([Role.DIRECTOR, Role.SALE])"
              title="Quản lý user">
              <span class="icon">&#128100;</span><span class="label">Quản lý User</span>
            </a>
            <a
              routerLink="/app/users"
              [queryParams]="{ role: 'PARENT' }"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ paths: 'exact', queryParams: 'exact', matrixParams: 'ignored', fragment: 'ignored' }"
              *ngIf="hasRole([Role.DIRECTOR])"
              title="Tài khoản phụ huynh">
              <span class="icon">&#128101;</span><span class="label">TK phụ huynh</span>
            </a>
            <a routerLink="/app/products" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR])" title="Quản lý gói sản phẩm">
              <span class="icon">&#128218;</span><span class="label">Quản lý gói sản phẩm</span>
            </a>
            <a routerLink="/app/students" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.SALE])" title="Quản lý học sinh">
              <span class="icon">&#127891;</span><span class="label">Quản lý học sinh</span>
            </a>
            <a routerLink="/app/classes" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.TEACHER, Role.SALE])" title="Quản lý lớp học">
              <span class="icon">&#127979;</span><span class="label">Quản lý lớp học</span>
            </a>
          </div>
        </div>

        <div class="menu-group" [class.open]="menuGroups['sales']" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.SALE])">
          <button class="menu-group-header" (click)="toggleGroup('sales')" *ngIf="!sidebarCollapsed">
            <span class="group-icon">&#128176;</span>
            <span class="group-label">Kinh doanh</span>
            <span class="group-arrow">{{ menuGroups['sales'] ? '&#9650;' : '&#9660;' }}</span>
          </button>
          <div class="menu-group-items" [class.collapsed-sidebar]="sidebarCollapsed">
            <a routerLink="/app/leads" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.SALE])" title="Khách hàng tiềm năng">
              <span class="icon">&#128161;</span><span class="label">KH tiềm năng</span>
            </a>
            <a routerLink="/app/orders" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.SALE])" title="Đơn đăng ký">
              <span class="icon">&#128203;</span><span class="label">Đơn đăng ký</span>
            </a>
            <a routerLink="/app/commission-report" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.SALE, Role.ACCOUNTING])" title="Hoa hồng">
              <span class="icon">&#128178;</span><span class="label">BC hoa hồng</span>
            </a>
          </div>
        </div>

        <div class="menu-group" [class.open]="menuGroups['ads']" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.ADSMANAGER])">
          <button class="menu-group-header" (click)="toggleGroup('ads')" *ngIf="!sidebarCollapsed">
            <span class="group-icon">&#128226;</span>
            <span class="group-label">Quảng cáo</span>
            <span class="group-arrow">{{ menuGroups['ads'] ? '&#9650;' : '&#9660;' }}</span>
          </button>
          <div class="menu-group-items" [class.collapsed-sidebar]="sidebarCollapsed">
            <a routerLink="/app/ads-management" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.ADSMANAGER])" title="Quản lý quảng cáo">
              <span class="icon">&#128227;</span><span class="label">Quản lý QC</span>
            </a>
            <a routerLink="/app/ads-analytics" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.ADSMANAGER])" title="Phân tích quảng cáo">
              <span class="icon">&#128200;</span><span class="label">Phân tích QC</span>
            </a>
          </div>
        </div>

        <div class="menu-group" [class.open]="menuGroups['chatbot']" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.SALE, Role.ADSMANAGER])">
          <button class="menu-group-header" (click)="toggleGroup('chatbot')" *ngIf="!sidebarCollapsed">
            <span class="group-icon">&#128172;</span>
            <span class="group-label">Chatbot</span>
            <span class="group-arrow">{{ menuGroups['chatbot'] ? '&#9650;' : '&#9660;' }}</span>
          </button>
          <div class="menu-group-items" [class.collapsed-sidebar]="sidebarCollapsed">
            <a routerLink="/app/conversations" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.SALE])" title="Hội thoại">
              <span class="icon">&#128172;</span><span class="label">Hội thoại</span>
            </a>
            <a routerLink="/app/chatbot-settings" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.ADSMANAGER])" title="Cài đặt chatbot">
              <span class="icon">&#9881;</span><span class="label">Cài đặt Chatbot</span>
            </a>
          </div>
        </div>

        <div class="menu-group" [class.open]="menuGroups['learning']" *ngIf="hasRole([Role.PARENT])">
          <button class="menu-group-header" (click)="toggleGroup('learning')" *ngIf="!sidebarCollapsed">
            <span class="group-icon">&#128218;</span>
            <span class="group-label">Học tập</span>
            <span class="group-arrow">{{ menuGroups['learning'] ? '&#9650;' : '&#9660;' }}</span>
          </button>
          <div class="menu-group-items" [class.collapsed-sidebar]="sidebarCollapsed">
            <a routerLink="/app/student-progress" routerLinkActive="active" title="Tiến trình học">
              <span class="icon">&#128200;</span><span class="label">Tiến trình học</span>
            </a>
            <a routerLink="/app/parent-attendance" routerLinkActive="active" title="Lịch sử điểm danh">
              <span class="icon">&#9745;</span><span class="label">Điểm danh</span>
            </a>
            <a routerLink="/app/sessions" routerLinkActive="active" title="Buổi học">
              <span class="icon">&#128197;</span><span class="label">Buổi học</span>
            </a>
            <a routerLink="/app/parent-calendar" routerLinkActive="active" title="Lịch học">
              <span class="icon">&#128198;</span><span class="label">Lịch học</span>
            </a>
          </div>
        </div>

        <div class="menu-group" [class.open]="menuGroups['teaching']" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.TEACHER, Role.ACCOUNTING, Role.SALE])">
          <button class="menu-group-header" (click)="toggleGroup('teaching')" *ngIf="!sidebarCollapsed">
            <span class="group-icon">&#127891;</span>
            <span class="group-label">Giảng dạy</span>
            <span class="group-arrow">{{ menuGroups['teaching'] ? '&#9650;' : '&#9660;' }}</span>
          </button>
          <div class="menu-group-items" [class.collapsed-sidebar]="sidebarCollapsed">
            <a routerLink="/app/sessions" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.TEACHER, Role.ACCOUNTING])" title="Buổi học">
              <span class="icon">&#128197;</span><span class="label">Buổi học</span>
            </a>
            <a routerLink="/app/attendance" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.TEACHER])" title="Điểm danh">
              <span class="icon">&#9745;</span><span class="label">Điểm danh</span>
            </a>
            <a routerLink="/app/teaching-materials" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.TEACHER])" title="Tài liệu giảng dạy">
              <span class="icon">&#128194;</span><span class="label">Tài liệu GD</span>
            </a>
            <a routerLink="/app/teaching-report" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.TEACHER, Role.ACCOUNTING])" title="Báo cáo giảng dạy">
              <span class="icon">&#128221;</span><span class="label">BC giảng dạy</span>
            </a>
            <a routerLink="/app/teacher-kpi" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR])" title="KPI giáo viên">
              <span class="icon">&#127942;</span><span class="label">KPI giáo viên</span>
            </a>
            <a routerLink="/app/calendar-overview" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR])" title="Lịch tổng quan">
              <span class="icon">&#128197;</span><span class="label">Lịch tổng quan</span>
            </a>
            <a routerLink="/app/teacher-profiles" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING, Role.SALE])" title="Quản lý giáo viên">
              <span class="icon">&#128101;</span><span class="label">Quản lý giáo viên</span>
            </a>
            <a routerLink="/app/teacher-profile" routerLinkActive="active" *ngIf="hasRole([Role.TEACHER])" title="Hồ sơ giảng dạy">
              <span class="icon">&#128100;</span><span class="label">Hồ sơ cá nhân</span>
            </a>
            <a routerLink="/app/teacher-calendar" routerLinkActive="active" *ngIf="hasRole([Role.TEACHER])" title="Lịch dạy">
              <span class="icon">&#128198;</span><span class="label">Lịch dạy</span>
            </a>
            <a routerLink="/app/teacher-substitute-request" routerLinkActive="active" *ngIf="hasRole([Role.TEACHER])" title="Xin nghỉ hoặc thay thế">
              <span class="icon">&#128260;</span><span class="label">Xin nghỉ/Thay thế</span>
            </a>
            <a routerLink="/app/employee-performance" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR])" title="Hiệu suất nhân viên">
              <span class="icon">&#127942;</span><span class="label">Hiệu suất NV</span>
            </a>
          </div>
        </div>

        <div class="menu-group" [class.open]="menuGroups['finance']" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.SALE, Role.PARENT, Role.TEACHER])">
          <button class="menu-group-header" (click)="toggleGroup('finance')" *ngIf="!sidebarCollapsed">
            <span class="group-icon">&#128181;</span>
            <span class="group-label">Tài chính</span>
            <span class="group-arrow">{{ menuGroups['finance'] ? '&#9650;' : '&#9660;' }}</span>
          </button>
          <div class="menu-group-items" [class.collapsed-sidebar]="sidebarCollapsed">
            <a routerLink="/app/invoices" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.SALE])" title="Quản lý hóa đơn">
              <span class="icon">&#128196;</span><span class="label">Quản lý hóa đơn</span>
            </a>
            <a routerLink="/app/parent-invoices" routerLinkActive="active" *ngIf="hasRole([Role.PARENT])" title="Hóa đơn của tôi">
              <span class="icon">&#128196;</span><span class="label">Hóa đơn của tôi</span>
            </a>
            <a routerLink="/app/wallets" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.PARENT])" title="Quản lý ví">
              <span class="icon">&#128176;</span><span class="label">Quản lý ví</span>
            </a>
            <a routerLink="/app/payroll" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.TEACHER])" title="Thanh toán lương giáo viên">
              <span class="icon">&#128181;</span><span class="label">Lương GV (session)</span>
            </a>
            <a routerLink="/app/work-sessions" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.TEACHER, Role.SALE])" title="Chấm công">
              <span class="icon">&#9201;</span><span class="label">Chấm công</span>
            </a>
            <a routerLink="/app/salary-config" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING])" title="Cấu hình lương">
              <span class="icon">&#9881;</span><span class="label">Cấu hình lương</span>
            </a>
            <a routerLink="/app/staff-payroll" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS])" title="Bảng lương nhân viên">
              <span class="icon">&#128176;</span><span class="label">Bảng lương NV</span>
            </a>
            <a routerLink="/app/expenses" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS])" title="Chi phí khác">
              <span class="icon">&#128184;</span><span class="label">Chi phí khác</span>
            </a>
            <a routerLink="/app/loans" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING])" title="Quản lý vốn vay">
              <span class="icon">&#128178;</span><span class="label">Vốn vay</span>
            </a>
            <a routerLink="/app/financial-control" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING])" title="Kiểm soát tài chính">
              <span class="icon">&#127974;</span><span class="label">KS tài chính</span>
            </a>
            <a routerLink="/app/aging-report" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING])" title="Công nợ phải thu">
              <span class="icon">&#128203;</span><span class="label">Công nợ phải thu</span>
            </a>
            <a routerLink="/app/bank-reconciliation" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING])" title="Đối soát ngân hàng">
              <span class="icon">&#127974;</span><span class="label">Đối soát NH</span>
            </a>
          </div>
        </div>

        <div class="menu-group" [class.open]="menuGroups['reports']" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.TEACHER])">
          <button class="menu-group-header" (click)="toggleGroup('reports')" *ngIf="!sidebarCollapsed">
            <span class="group-icon">&#128202;</span>
            <span class="group-label">Báo cáo</span>
            <span class="group-arrow">{{ menuGroups['reports'] ? '&#9650;' : '&#9660;' }}</span>
          </button>
          <div class="menu-group-items" [class.collapsed-sidebar]="sidebarCollapsed">
            <a routerLink="/app/attendance-report" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.TEACHER])" title="Báo cáo điểm danh">
              <span class="icon">&#128202;</span><span class="label">BC điểm danh</span>
            </a>
            <a routerLink="/app/student-report" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING])" title="Báo cáo học sinh">
              <span class="icon">&#128203;</span><span class="label">BC học sinh</span>
            </a>
            <a routerLink="/app/comprehensive-report" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING])" title="Báo cáo tổng hợp">
              <span class="icon">&#128200;</span><span class="label">BC tổng hợp</span>
            </a>
            <a routerLink="/app/export-reports" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR, Role.ACCOUNTING])" title="Xuất báo cáo">
              <span class="icon">&#128230;</span><span class="label">Xuất báo cáo</span>
            </a>
          </div>
        </div>

        <div class="menu-group" [class.open]="menuGroups['system']">
          <button class="menu-group-header" (click)="toggleGroup('system')" *ngIf="!sidebarCollapsed">
            <span class="group-icon">&#9881;</span>
            <span class="group-label">Hệ thống</span>
            <span class="group-arrow">{{ menuGroups['system'] ? '&#9650;' : '&#9660;' }}</span>
          </button>
          <div class="menu-group-items" [class.collapsed-sidebar]="sidebarCollapsed">
            <a routerLink="/app/tickets" routerLinkActive="active" title="Hỗ trợ và ticket">
              <span class="icon">&#127915;</span><span class="label">Hỗ trợ & Ticket</span>
            </a>
            <a
              routerLink="/app/parent-chat"
              routerLinkActive="active"
              *ngIf="hasRole([Role.PARENT])"
              title="Chat hỗ trợ phụ huynh">
              <span class="icon">&#128172;</span><span class="label">Chat hỗ trợ</span>
            </a>
            <a
              routerLink="/app/messages"
              routerLinkActive="active"
              *ngIf="!hasRole([Role.PARENT])"
              title="Tin nhắn nội bộ">
              <span class="icon">&#128172;</span><span class="label">Tin nhắn</span>
            </a>
            <a routerLink="/app/audit-log" routerLinkActive="active" *ngIf="hasRole([Role.DIRECTOR])" title="Nhật ký hoạt động">
              <span class="icon">&#128270;</span><span class="label">Nhật ký HĐ</span>
            </a>
          </div>
        </div>
      </nav>

      <div class="user-info" *ngIf="!sidebarCollapsed">
        <div class="user-name">{{ auth.userSignal()?.fullName }}</div>
        <small class="user-role">{{ getRoleLabel(auth.userSignal()?.role) }}</small>
      </div>

      <button class="logout" (click)="auth.logout()" [class.compact]="sidebarCollapsed">
        {{ sidebarCollapsed ? '&#10140;' : 'Đăng xuất' }}
      </button>
    </aside>

    <main class="content">
      <div class="route-loading" *ngIf="routeLoading"></div>
      <router-outlet></router-outlet>
    </main>
  </div>
  `,
  styles: [`
    :host { display:block; height:100vh; overflow:hidden; }
    .layout {
      display:flex;
      height:100%;
      min-height:0;
      overflow:hidden;
      background:#e2e8f0;
      font-family:'Segoe UI',sans-serif;
    }
    .sidebar {
      width:250px; background:#0f172a; color:#e2e8f0; padding:16px;
      display:flex; flex-direction:column; position:relative; transition:width 0.2s ease;
      min-height:0;
      overflow-y:auto;
      overflow-x:hidden;
    }
    .sidebar.collapsed { width:60px; align-items:center; padding:16px 8px; }
    .toggle {
      position:absolute; top:12px; right:12px; border:none; background:#1e293b;
      color:#e2e8f0; border-radius:999px; width:32px; height:32px; cursor:pointer;
      font-size:14px; display:flex; align-items:center; justify-content:center;
    }
    .sidebar.collapsed .toggle { position:static; margin-bottom:12px; }
    .sidebar h3 { margin:44px 0 0; font-size:13px; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; }
    nav { margin-top:16px; width:100%; flex:1; }

    .menu-group { margin-bottom:2px; }
    .menu-group-header {
      display:flex; align-items:center; gap:8px; width:100%; padding:8px 12px;
      border:none; background:#1e293b; color:#7dd3fc; cursor:pointer;
      font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px;
      border-radius:6px; transition:background 0.15s, color 0.15s;
      border-left:3px solid #38bdf8;
    }
    .menu-group-header:hover { background:#273548; color:#bae6fd; }
    .menu-group.open .menu-group-header { background:#1e3a5f; color:#38bdf8; border-left-color:#38bdf8; }
    .group-icon { font-size:14px; min-width:18px; text-align:center; }
    .group-label { flex:1; text-align:left; }
    .group-arrow { font-size:9px; opacity:0.7; transition:transform 0.2s; }
    .menu-group-items {
      max-height:0; overflow:hidden; transition:max-height 0.25s ease;
      background:#0a1628; border-radius:0 0 6px 6px;
    }
    .menu-group.open .menu-group-items { max-height:500px; }
    .menu-group-items.collapsed-sidebar { max-height:none !important; overflow:visible; }
    .menu-group-items a { padding-left:28px; }
    .sidebar.collapsed .menu-group-items a { padding-left:0; }

    nav a {
      display:flex; align-items:center; gap:10px; padding:8px 12px; margin-bottom:1px;
      text-decoration:none; border-radius:4px; color:#94a3b8; font-size:13px;
      transition:background 0.15s, color 0.15s;
      border-left:2px solid transparent;
    }
    nav a:hover { background:#1e293b; color:#e2e8f0; border-left-color:#475569; }
    nav a.active {
      background:#431407; color:#fb923c; font-weight:600;
      border-left:2px solid #f97316;
    }
    .icon { font-size:16px; min-width:20px; text-align:center; }
    .sidebar.collapsed .label { display:none; }
    .sidebar.collapsed nav a { justify-content:center; padding:10px; }
    .sidebar.collapsed .menu-group-header { display:none; }
    .sidebar.collapsed .menu-group { margin-bottom:0; }
    .nav-badge {
      margin-left:auto; background:#dc2626; color:#fff; border-radius:999px;
      font-size:10px; padding:1px 6px; font-weight:700; min-width:16px; text-align:center;
    }
    .sidebar.collapsed .nav-badge { display:none; }
    .user-info { margin-top:auto; padding:12px 0; border-top:1px solid #1e293b; }
    .user-name { font-weight:600; font-size:14px; }
    .user-role { color:#94a3b8; font-size:12px; }
    .logout {
      margin-top:8px; padding:8px 12px; border:none; border-radius:6px;
      background:#dc2626; color:#fff; cursor:pointer; font-size:13px; font-weight:600;
      transition:background 0.15s;
    }
    .logout:hover { background:#b91c1c; }
    .logout.compact { padding:8px; font-size:16px; }
    .content {
      flex:1;
      min-width:0;
      min-height:0;
      overflow-y:auto;
      position:relative;
    }
    .route-loading {
      height:3px;
      left:0;
      overflow:hidden;
      position:sticky;
      top:0;
      width:100%;
      z-index:5;
      background:rgba(15,118,110,0.08);
    }
    .route-loading::after {
      animation:route-progress 1.1s ease-in-out infinite;
      background:linear-gradient(90deg, #0f766e 0%, #22c55e 45%, #0f766e 100%);
      content:'';
      display:block;
      height:100%;
      width:38%;
    }
    @keyframes route-progress {
      0% { transform:translateX(-100%); }
      100% { transform:translateX(280%); }
    }
  `]
})
export class AppShellComponent implements OnInit, OnDestroy {
  Role = Role;
  sidebarCollapsed = false;
  unreadNotifCount = 0;
  pendingCount = 0;
  routeLoading = false;

  menuGroups: Record<string, boolean> = {
    overview: true,
    management: true,
    sales: true,
    ads: false,
    chatbot: false,
    learning: true,
    teaching: true,
    finance: true,
    reports: false,
    system: false,
  };

  private notifSvc = inject(NotificationsService);
  private pendingSvc = inject(PendingApprovalsService);
  private routePrefetch = inject(RoutePrefetchService);
  private router = inject(Router);
  private refreshInterval: any;
  private routerEventsSub?: Subscription;
  private readonly visibilityChangeHandler = () => {
    if (!this.isDocumentHidden()) {
      void this.loadCounts();
    }
  };

  constructor(public auth: AuthService) {}

  ngOnInit() {
    this.restoreSidebarState();
    void this.loadCountsIfVisible();
    this.routePrefetch.warmForRole(this.auth.userSignal()?.role);
    this.refreshInterval = setInterval(() => this.loadCountsIfVisible(), 60000);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    }
    this.routerEventsSub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart || event instanceof RouteConfigLoadStart) {
        this.routeLoading = true;
        return;
      }

      if (
        event instanceof NavigationEnd
        || event instanceof NavigationCancel
        || event instanceof NavigationError
        || event instanceof RouteConfigLoadEnd
      ) {
        this.routeLoading = false;
      }
    });
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.routerEventsSub?.unsubscribe();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }
  }

  async loadCounts() {
    try {
      const { count } = await this.notifSvc.getUnreadCount();
      this.unreadNotifCount = count;
    } catch {}
    if (this.hasRole([Role.DIRECTOR])) {
      try {
        const summary = await this.pendingSvc.getSummary();
        this.pendingCount = summary.totalPending || 0;
      } catch {}
    }
  }

  private async loadCountsIfVisible() {
    if (this.isDocumentHidden()) {
      return;
    }

    await this.loadCounts();
  }

  private isDocumentHidden(): boolean {
    return typeof document !== 'undefined' && document.hidden;
  }

  private restoreSidebarState(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      this.sidebarCollapsed = window.localStorage.getItem(SIDEBAR_STATE_STORAGE_KEY) === 'true';
    } catch {
      this.sidebarCollapsed = false;
    }
  }

  private persistSidebarState(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(SIDEBAR_STATE_STORAGE_KEY, String(this.sidebarCollapsed));
    } catch {
      // Ignore storage failures and keep the UI interactive.
    }
  }

  hasRole(roles: Role[]): boolean {
    const userRole = this.auth.userSignal()?.role;
    if (!userRole) return false;
    return roles.includes(userRole as Role);
  }

  getRoleLabel(role?: string): string {
    return role ? (ROLE_LABELS[role] || role) : '';
  }

  getHandbookLabel(): string {
    const role = this.auth.userSignal()?.role;
    const labels: Record<string, string> = {
      DIRECTOR: 'Cẩm nang GD',
      ACCOUNTING: 'Cẩm nang KT',
      OPS: 'Cẩm nang VH',
      ADSMANAGER: 'Cẩm nang Ads',
      TEACHER: 'Cẩm nang GV',
      PARENT: 'Cẩm nang PH',
      SALE: 'Cẩm nang Sale',
    };
    return labels[role || ''] || 'Cẩm nang nội bộ';
  }

  getHandbookRoute(): string {
    const role = this.auth.userSignal()?.role;
    const routes: Record<string, string> = {
      TEACHER: '/app/teacher-hub',
      SALE: '/app/sale-hub',
      DIRECTOR: '/app/internal-handbook',
      ACCOUNTING: '/app/internal-handbook',
      OPS: '/app/internal-handbook',
      ADSMANAGER: '/app/internal-handbook',
      PARENT: '/app/internal-handbook',
    };
    return routes[role || ''] || '/app/internal-handbook';
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.persistSidebarState();
  }

  toggleGroup(group: string): void {
    this.menuGroups[group] = !this.menuGroups[group];
  }
}
