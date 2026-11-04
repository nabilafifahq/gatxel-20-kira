import type { Metadata } from 'next'

/**
 * Metadata berbagi untuk halaman panduan: judul dan gambar yang muncul saat tautan ditempel di WhatsApp.
 * Gambar berbagi berbentuk PNG karena pratinjau WhatsApp tidak selalu menampilkan webp.
 */
export function guideMetadata(origin: string, page: { title: string; description: string; path: string }): Metadata {
  const url = `${origin}${page.path}`
  return {
    metadataBase: new URL(origin),
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      siteName: 'Kira',
      locale: 'id_ID',
      title: page.title,
      description: page.description,
      url,
      images: [{ url: `${origin}/panduan-img/berbagi.png`, width: 1200, height: 630, alt: 'Maskot bintang Kira dan tulisan Panduan Kira' }],
    },
    twitter: { card: 'summary_large_image', title: page.title, description: page.description, images: [`${origin}/panduan-img/berbagi.png`] },
  }
}
