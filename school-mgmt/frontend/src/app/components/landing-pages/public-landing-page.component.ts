import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  LandingPageService,
  PublicLandingPageView,
  TrackingPayload,
} from '../../services/landing-page.service';

@Component({
  selector: 'app-public-landing-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './public-landing-page.component.html',
  styleUrls: ['./public-landing-page.component.css'],
})
export class PublicLandingPageComponent implements OnInit, OnDestroy {
  readonly page = signal<PublicLandingPageView | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly submitError = signal('');
  readonly submitted = signal(false);
  readonly submitResult = signal<any | null>(null);

  readonly form = {
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    studentName: '',
    studentGrade: '',
    notes: '',
  };

  private readonly injectedNodes: Node[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly landingPageService: LandingPageService,
  ) {}

  async ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug') || '';
    if (!slug) {
      this.error.set('Khong tim thay landing page.');
      this.loading.set(false);
      return;
    }

    try {
      const page = await this.landingPageService.getPublicBySlug(slug);
      this.page.set(page);
      document.title = page.name;
      this.installTrackingAssets(page);
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Khong tai duoc landing page.');
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy() {
    for (const node of this.injectedNodes) {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
  }

  private appendHtml(target: HTMLElement, html?: string) {
    const markup = String(html || '').trim();
    if (!markup) return;

    const template = document.createElement('template');
    template.innerHTML = markup;
    const nodes = Array.from(template.content.childNodes);

    for (const node of nodes) {
      const appended = this.cloneNodeWithScripts(node);
      target.appendChild(appended);
      this.injectedNodes.push(appended);
    }
  }

  private cloneNodeWithScripts(node: Node): Node {
    if (node instanceof HTMLScriptElement) {
      const script = document.createElement('script');
      for (const attribute of Array.from(node.attributes)) {
        script.setAttribute(attribute.name, attribute.value);
      }
      script.text = node.text;
      return script;
    }

    const clone = node.cloneNode(true);
    if (clone instanceof HTMLElement) {
      const scripts = Array.from(clone.querySelectorAll('script'));
      for (const scriptNode of scripts) {
        const freshScript = document.createElement('script');
        for (const attribute of Array.from(scriptNode.attributes)) {
          freshScript.setAttribute(attribute.name, attribute.value);
        }
        freshScript.text = scriptNode.text;
        scriptNode.parentNode?.replaceChild(freshScript, scriptNode);
      }
    }
    return clone;
  }

  private ensureExternalScript(id: string, src: string) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
    this.injectedNodes.push(script);
  }

  private installMetaPixel(pixelId?: string) {
    const normalized = String(pixelId || '').trim();
    if (!normalized) return;

    const win = window as any;
    if (!win.fbq) {
      ((f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) => {
        if (f.fbq) return;
        n = f.fbq = (...args: any[]) => {
          if (n.callMethod) {
            n.callMethod.apply(n, args);
          } else {
            n.queue.push(args);
          }
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = true;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    }

    win.__landingMetaPixelIds = win.__landingMetaPixelIds || new Set<string>();
    if (!win.__landingMetaPixelIds.has(normalized)) {
      win.fbq('init', normalized);
      win.__landingMetaPixelIds.add(normalized);
    }
    win.fbq('track', 'PageView');
  }

  private installGoogleTag(page: PublicLandingPageView) {
    const googleTagId = String(page.googleTagId || '').trim();
    const adsTagId = page.googleAdsConversionId ? `AW-${page.googleAdsConversionId}` : '';
    const primaryTagId = googleTagId || adsTagId;
    if (!primaryTagId) return;

    this.ensureExternalScript(
      `landing-gtag-${primaryTagId}`,
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primaryTagId)}`,
    );

    const win = window as any;
    win.dataLayer = win.dataLayer || [];
    win.gtag = win.gtag || function gtag(...args: any[]) { win.dataLayer.push(args); };
    win.gtag('js', new Date());
    win.gtag('config', primaryTagId);
    if (adsTagId && adsTagId !== primaryTagId) {
      win.gtag('config', adsTagId);
    }
  }

  private installTikTokPixel(pixelId?: string) {
    const normalized = String(pixelId || '').trim();
    if (!normalized) return;

    const win = window as any;
    if (!win.ttq) {
      ((w: any, d: Document, t: string) => {
        w.TiktokAnalyticsObject = t;
        const ttq = w[t] = w[t] || [];
        ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
        ttq.setAndDefer = function setAndDefer(obj: any, method: string) {
          obj[method] = function () {
            obj.push([method].concat(Array.prototype.slice.call(arguments, 0)));
          };
        };
        for (const method of ttq.methods) {
          ttq.setAndDefer(ttq, method);
        }
        ttq.load = function load(pixel: string) {
          const script = d.createElement('script');
          script.async = true;
          script.src = 'https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=' + pixel + '&lib=' + t;
          const firstScript = d.getElementsByTagName('script')[0];
          firstScript.parentNode?.insertBefore(script, firstScript);
        };
      })(window, document, 'ttq');
    }

    win.__landingTikTokPixels = win.__landingTikTokPixels || new Set<string>();
    if (!win.__landingTikTokPixels.has(normalized)) {
      win.ttq.load(normalized);
      win.ttq.page();
      win.__landingTikTokPixels.add(normalized);
    }
  }

  private installTrackingAssets(page: PublicLandingPageView) {
    this.installMetaPixel(page.metaPixelId);
    this.installGoogleTag(page);
    this.installTikTokPixel(page.tiktokPixelId);
    this.appendHtml(document.head, page.customHeadHtml);
    this.appendHtml(document.body, page.customBodyHtml);
  }

  private getCookie(name: string): string {
    const all = document.cookie || '';
    const items = all.split(';').map((item) => item.trim());
    const found = items.find((item) => item.startsWith(`${name}=`));
    return found ? decodeURIComponent(found.slice(name.length + 1)) : '';
  }

  private inferPlatform(tracking: TrackingPayload, page: PublicLandingPageView): string | undefined {
    if (page.defaultPlatform) return page.defaultPlatform;
    if (tracking.fbclid || tracking.fbc || tracking.fbp) return 'FACEBOOK';
    if (tracking.gclid || tracking.gbraid || tracking.wbraid) return 'GOOGLE';
    if (tracking.ttclid || tracking.ttp) return 'TIKTOK';
    return undefined;
  }

  private resolveAdRefParam(params: URLSearchParams): string | undefined {
    const candidates = [
      'ad_id',
      'adset_id',
      'adgroup_id',
      'utm_id',
      'ref',
      'campaign_id',
    ];
    for (const key of candidates) {
      const value = String(params.get(key) || '').trim();
      if (value) return value;
    }
    return undefined;
  }

  private createEventId(): string {
    return `lp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private buildTracking(page: PublicLandingPageView): TrackingPayload {
    const params = new URLSearchParams(window.location.search);
    const fbclid = String(params.get('fbclid') || '').trim();
    const fbc = this.getCookie('_fbc') || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : '');
    return {
      landingPageId: page._id,
      landingPageSlug: page.slug,
      landingPageName: page.name,
      submittedUrl: window.location.href,
      referrerUrl: document.referrer || undefined,
      eventId: this.createEventId(),
      fbclid: fbclid || undefined,
      fbc: fbc || undefined,
      fbp: this.getCookie('_fbp') || undefined,
      gclid: String(params.get('gclid') || '').trim() || undefined,
      gbraid: String(params.get('gbraid') || '').trim() || undefined,
      wbraid: String(params.get('wbraid') || '').trim() || undefined,
      ttclid: String(params.get('ttclid') || '').trim() || undefined,
      ttp: this.getCookie('_ttp') || undefined,
      utmSource: String(params.get('utm_source') || '').trim() || undefined,
      utmMedium: String(params.get('utm_medium') || '').trim() || undefined,
      utmCampaign: String(params.get('utm_campaign') || '').trim() || undefined,
      utmContent: String(params.get('utm_content') || '').trim() || undefined,
      utmTerm: String(params.get('utm_term') || '').trim() || undefined,
    };
  }

  private fireConversionEvents(page: PublicLandingPageView, tracking: TrackingPayload) {
    const win = window as any;

    if (page.metaPixelId && win.fbq) {
      win.fbq('track', 'Lead', { landing_page: page.slug }, { eventID: tracking.eventId });
    }

    if (win.gtag) {
      if (page.googleAdsConversionId && page.googleAdsConversionLabel) {
        win.gtag('event', 'conversion', {
          send_to: `AW-${page.googleAdsConversionId}/${page.googleAdsConversionLabel}`,
          value: 1,
          currency: 'VND',
        });
      } else if (page.googleTagId) {
        win.gtag('event', 'generate_lead', { landing_page: page.slug });
      }
    }

    if (page.tiktokPixelId && win.ttq) {
      win.ttq.track('SubmitForm', { landing_page: page.slug });
    }
  }

  async submitForm() {
    const page = this.page();
    if (!page) return;

    this.submitting.set(true);
    this.submitError.set('');

    try {
      const tracking = this.buildTracking(page);
      const params = new URLSearchParams(window.location.search);
      const result = await this.landingPageService.submitPublic(page.slug, {
        parentName: this.form.parentName,
        parentPhone: this.form.parentPhone,
        parentEmail: this.form.parentEmail || undefined,
        studentName: this.form.studentName || undefined,
        studentGrade: this.form.studentGrade || undefined,
        notes: this.form.notes || undefined,
        platform: this.inferPlatform(tracking, page),
        adRefParam: this.resolveAdRefParam(params),
        tracking,
      });

      this.submitResult.set(result);
      this.submitted.set(true);
      this.fireConversionEvents(page, tracking);
    } catch (err: any) {
      this.submitError.set(err?.error?.message || 'Khong gui duoc form. Vui long thu lai.');
    } finally {
      this.submitting.set(false);
    }
  }
}
