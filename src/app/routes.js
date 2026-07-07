export const routeDefinitions = [
  { path: '/', title: 'Home', loader: () => import('../pages/home/home.js') },
  { path: '/discover', title: 'Discover', loader: () => import('../pages/discover/discover.js') },
  {
    path: '/dogs/:id',
    title: 'Dog profile',
    loader: () => import('../pages/dogs/dog-detail.js'),
  },
  { path: '/adoption', title: 'Adoption', loader: () => import('../pages/adoption/adoption.js') },
  { path: '/lost-dogs', title: 'Lost Dogs', loader: () => import('../pages/lost-dogs/lost-dogs.js') },
  { path: '/places', title: 'Places', loader: () => import('../pages/places/places.js') },
  { path: '/login', title: 'Login', loader: () => import('../pages/login/login.js') },
  { path: '/register', title: 'Register', loader: () => import('../pages/register/register.js') },
  { path: '/profile', title: 'Profile', loader: () => import('../pages/profile/profile.js') },
  { path: '/admin', title: 'Admin', loader: () => import('../pages/admin/admin.js') },
]

function normalizePath(pathname) {
  if (!pathname || pathname === '/') {
    return '/'
  }

  return pathname.replace(/\/$/, '')
}

export function matchRoute(pathname) {
  const normalizedPath = normalizePath(pathname)

  for (const route of routeDefinitions) {
    if (route.path === normalizedPath) {
      return { route, params: {} }
    }

    if (route.path.includes(':id')) {
      const match = normalizedPath.match(/^\/dogs\/([^/]+)$/)

      if (match) {
        return { route, params: { id: match[1] } }
      }
    }
  }

  return { route: routeDefinitions[0], params: {} }
}

export function isSameRoute(pathname, targetPath) {
  return normalizePath(pathname) === normalizePath(targetPath)
}