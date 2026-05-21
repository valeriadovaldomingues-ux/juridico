import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Aurora PEDV',
    short_name: 'Aurora PEDV',
    description: 'Chat mobile da Aurora para sócios do Pessoa e do Val Advocacia.',
    start_url: '/aurora-mobile',
    scope: '/',
    display: 'standalone',
    background_color: '#07111f',
    theme_color: '#07111f',
    icons: [
      {
        src: '/logo-pedv-tv.jpeg',
        sizes: 'any',
        type: 'image/jpeg',
      },
    ],
  }
}
