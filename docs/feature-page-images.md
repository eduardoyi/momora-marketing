# Feature page images — brief

New photography for the feature pages in `src/features/` (built to `/<slug>/` by
`buildFeaturePages()` in `build.js`). The pages currently ship with existing
assets; these images upgrade them. Generate with the image connector
(`generate_image` / `edit_image`), then convert with Pillow to WebP (quality 80,
≤1600px wide) into `assets/images/home/` and wire each one in as described.

## Rules

- **Demo family only:** the Kim-Ortiz family. Maya (5, long curly brown hair), Theo (3, curly dark hair), baby Ari, parents Sam and Alex, Grandma Rosa. The repo is public, so no real family photos or PII.
- **Identity references:** pass these as `image_urls` to `edit_image` so faces match the rest of the site.
  - Maya and Theo: `https://image-connector.eduardoyi.workers.dev/img/bea19390-9338-46b2-96de-1800f6348b7d.jpg`
  - Maya: `https://image-connector.eduardoyi.workers.dev/img/a3de4b0e-730b-4e51-a5c4-506f003e1b56.jpg`
  - All three kids: `https://image-connector.eduardoyi.workers.dev/img/237c7d8c-0edd-40b6-bfd9-ba50d95041bb.jpg`
  - Ari: `https://image-connector.eduardoyi.workers.dev/img/b9fd264d-03f7-4e27-a827-5eaab9b83b44.jpg`
- **Existing product shots, for style:**
  - Book: `…/img/ad32b530-80d3-4564-8f4a-946e88972516.jpg`
  - Holiday card: `…/img/84aef84b-ead2-4d67-a7b4-fd61931265b8.jpg`
- **Kids' drawings to reuse:**
  - rainbow `cbf0a590-6f3c-4b40-aa6c-aa092ab2d7a0`
  - dino `fd6d306f-2093-4b18-a55e-7500f78159d3`
  - house `28d9956c-96eb-4ff7-910c-f635b7b87a4b`
  - mama `a75f42be-b777-49fc-89e6-6f7c7f1a190a`

  All are at `https://image-connector.eduardoyi.workers.dev/img/<id>.jpg`.
- **Outfits:** every photo gets an explicit, distinct, season-appropriate outfit. Say "different clothes from the reference". Repeated outfits look AI-generated.
- **Look:** a real parent's photo or an editorial product shot, in natural light. No logos and no legible brand names. Printed photos inside books and cards must be real photographs, not illustrations, unless the brief says otherwise.
- **Check before wiring:** make a contact sheet, check faces, outfits and hands, and redo anything uncanny.

## Images

| # | File | Page → where | Prompt idea |
|---|------|--------------|-------------|
| 1 | `newborn-book-hands.webp` (3:2) | `/newborn-photo-book/` → replace the polaroid in the "Behind already? You're not." split | A parent's hands holding an open lay-flat hardcover baby book on a bed. The pages show real photos of baby Ari (ref) with short serif captions. Soft morning light, swaddle blanket nearby. |
| 2 | `yearbook-shelf.webp` (3:2) | `/family-yearbook/` → add as a photo in the "Each year has its own voice" split (keep the CSS shelf in the hero) | A living-room shelf with 5 raspberry and colored linen hardcover books, spines lettered "Year One"… "Year Five". Maya (ref, new outfit) is pulling one out on tiptoe. |
| 3 | `family-book-grandma.webp` (3:2) | `/family-photo-book/` → replace the spread in the "Photos with the story attached" split | Grandma Rosa (warm older Latina woman, grey bob, cardigan) and Theo (ref, new outfit) on a sofa, looking at the open Momora photo book. Real photos on the pages. |
| 4 | `art-book-spread.webp` (3:2) | `/kids-artwork/` → replace the spread in "Watch their drawings grow up with them" | An open lay-flat book on a table. The pages show the rainbow and house drawings (refs) printed with small captions, and crayons scattered nearby. |
| 5 | `holiday-cards-envelopes.webp` (3:2) | `/holiday-cards/` → new image beside the steps, or replacing the second split's photo | A kitchen table with a stack of the 5×7 holiday cards (style ref), kraft envelopes, a pen, Theo's hand reaching in. Evening light. |
| 6 | `year-end-set.webp` (3:2) | `/year-in-review-photo-book/` → replace the holiday-card photo in "The whole year-end set" | A cozy December table with the printed book (style ref), a holiday card, and a phone showing a paused family video. |
| 7 | `app-and-book.webp` (3:2) | `/photo-book-app/` → add under the comparison table, or as an og image | A phone showing a family timeline next to the printed book open on a table. A clean, editorial product shot. |
| 8 | og images (1200×630 JPG) | each feature page → front matter `ogImage:` | Crop from 1–7, or render each page's hero (see `og-home.jpg`, made with Playwright). |

After wiring:

1. Run `node build.js`.
2. Screenshot each page at desktop width (1440) and phone width (390).
3. Check that pages still don't scroll sideways on a phone.
