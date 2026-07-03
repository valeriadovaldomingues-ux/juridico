import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PEDV',
    short_name: 'PEDV',
    description: 'Sistema de gestão do Pessoa e do Val Advocacia.',
    start_url: '/dashboard',
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
