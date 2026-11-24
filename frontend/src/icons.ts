import { createLucideIcon } from 'lucide-react'

// The icons of the sections as drawn in mockup D. Lucide's own have other shapes.

export const OrganizationsIcon = createLucideIcon({
  name: 'organizations',
  size: 24,
  node: [['path', { d: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4', key: 'building' }]],
})

export const DealsIcon = createLucideIcon({
  name: 'deals',
  size: 24,
  node: [
    ['rect', { x: '2', y: '7', width: '20', height: '14', rx: '2', key: 'case' }],
    ['path', { d: 'M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 13h20', key: 'handle' }],
  ],
})

export const PipelineIcon = createLucideIcon({
  name: 'pipeline',
  size: 24,
  node: [['path', { d: 'M6 5v11M12 5v6M18 5v14', key: 'columns' }]],
})
