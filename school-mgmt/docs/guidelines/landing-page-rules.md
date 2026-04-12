# Quy tac tao landing page tren he thong

Tai lieu nay ap dung cho landing page tao boi nguoi dung hoac AI tren chinh he thong `school-mgmt`.

## 1. Muc tieu bat buoc

Moi landing page phai dam bao dong thoi 4 muc tieu:

1. Thu du thong tin phu huynh de doi ngu kinh doanh xu ly.
2. Giu dung attribution quang cao: `ad group`, `ad ref`, `pixel`, `click id`, `utm`.
3. Co kha nang dinh danh phu huynh trong he thong bang `phone`, `email`, `parent user`, `wallet`.
4. Co the tao lead tu dong ma khong mat dau vet landing page goc.

## 2. Endpoint va route chuan

- Public URL cua landing page: `/lp/:slug`
- API doc landing page public: `GET /public/landing-pages/:slug`
- API submit form: `POST /public/landing-pages/:slug/submit`
- API quan tri landing page: `/landing-pages`

AI khong duoc tao landing page submit ve endpoint khac neu muc dich la dua vao he thong quan ly hien tai.

## 3. Truong form toi thieu

Moi landing page phai co cac truong:

- `parentName`
- `parentPhone`
- `parentEmail` neu co
- `studentName` neu co
- `studentGrade` neu co
- `notes` neu co

Trong do `parentPhone` la dinh danh chinh de map sang:

- `User.role = PARENT`
- `Student.parentPhone`
- `Student.parentUserId`
- `Wallet.userId`

## 4. Tracking phai gui cung form

Landing page phai doc va gui len backend cac truong tracking sau:

- Facebook/Meta:
  - `fbclid`
  - `fbc`
  - `fbp`
- Google:
  - `gclid`
  - `gbraid`
  - `wbraid`
- TikTok:
  - `ttclid`
  - `ttp`
- UTM:
  - `utm_source`
  - `utm_medium`
  - `utm_campaign`
  - `utm_content`
  - `utm_term`
- Metadata:
  - `landingPageId`
  - `landingPageSlug`
  - `landingPageName`
  - `submittedUrl`
  - `referrerUrl`
  - `eventId`

Neu `fbclid` co mat nhung `_fbc` chua co, landing page nen tao `fbc` theo format Meta de tang kha nang match.

## 5. Quy tac map ad group

Backend map `adGroup` theo thu tu uu tien sau:

1. `adGroupId` truyen thang neu co.
2. `adRefParam`:
   - uu tien `ad_id`
   - sau do `adset_id`
   - sau do `adgroup_id`
   - sau do `utm_id`
   - sau do `ref`
   - sau do `campaign_id`
3. `defaultAdGroupId` cua landing page.

Neu can map `ad_id` hoac `ref` ve nhom quang cao, bat buoc phai khai bao `trackingKeys` trong man hinh `Ads Management > Groups`.

## 6. Quy tac dinh danh phu huynh va vi

Khi submit form, he thong se co gang match theo thu tu:

1. `parentEmail` -> `User(role=PARENT)`
2. `parentPhone` -> `User(role=PARENT)`
3. `parentPhone` -> `Student.parentPhone` -> `Student.parentUserId`
4. `parentUserId` da match -> `Wallet.userId`

AI phai uu tien giu `parentPhone` va `parentEmail` dung mot format nhat quan trong UI va payload.

Neu chua match duoc `User` hoac `Wallet`, submission van phai duoc luu de sau nay merge attribution khi phu huynh phat sinh user/order/invoice.

## 7. Quy tac pixel va tag

Landing page trong he thong da ho tro:

- `metaPixelId`
- `googleTagId`
- `googleAdsConversionId`
- `googleAdsConversionLabel`
- `tiktokPixelId`
- `customHeadHtml`
- `customBodyHtml`

Quy tac:

- Neu chi can pageview va lead event co ban, uu tien dung cac field typed o tren.
- Chi dung `customHeadHtml` va `customBodyHtml` khi can nhung doan script dac thu ma he thong chua co field typed.
- Khong duoc chen script redirect lam mat `fbclid/gclid/ttclid`.
- Khong duoc xoa query params tracking truoc khi form submit.

## 8. Quy tac cho AI-generated landing page

Khi AI tao landing page moi, prompt va template phai buoc AI lam dung cac diem sau:

1. Trang phai duoc publish bang `slug` hop le va duong dan `/lp/:slug`.
2. Form submit phai goi `POST /public/landing-pages/:slug/submit`.
3. Form khong duoc tu y doi ten cac field tracking chuan.
4. Trang phai co mot CTA ro rang de thu `parentPhone`.
5. Khong duoc chuyen form sang ben thu ba neu muon giu attribution trong he thong.
6. Neu co redirect sau submit, redirect chi duoc xay ra sau khi backend da tra ket qua thanh cong.
7. Moi event conversion client-side phai dung chung `eventId` voi payload submit neu sau nay can noi them CAPI/offline conversion.
8. Noi dung phai co dong thong bao ve viec thu thap thong tin lien he va tracking phuc vu tu van/doi soat.

## 9. Checklist truoc khi publish

- Da gan `defaultAdGroupId` hoac da co `trackingKeys` de map `ad_id/ref`
- Da nhap pixel/tag can thiet
- Da test submit voi query params `fbclid`, `gclid`, `ttclid`
- Da xac nhan submission tao ra `lead` neu `autoCreateLead = true`
- Da xac nhan submission hien `matchedParentUserId` / `matchedWalletId` dung khi dung phone/email da ton tai
- Da xac nhan landing page khong lam mat query params tracking

## 10. Luu y van hanh

- Landing page la cong cu acquisition, nhung attribution chot cuoi van nen doi chieu lai voi `lead`, `order`, `parent attribution`.
- Neu ads team doi cach gan `ad_id/ref`, phai cap nhat `trackingKeys` song song.
- Neu sau nay can day conversion len Google/Meta/TikTok server-side, du lieu da duoc luu san o `tracking`, `normalized phone/email`, `hashed sha256`.
