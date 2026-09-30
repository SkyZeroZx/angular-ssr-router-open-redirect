import { Component, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterOutlet,
  Routes,
} from '@angular/router';

// Test bench: the `:tenant` route below is the vector, the routes above it are the
// shapes that are not affected, and `login` carries the canonical returnUrl check.
// See README.md for the URLs to hit.

@Component({ imports: [RouterOutlet], template: '<router-outlet />' })
export class Layout {}

@Component({ template: 'page' })
export class Page {}

@Component({ template: 'home' })
export class Home {}

@Component({ template: 'login' })
export class Login {}

// Stands in for a backend call, to show guards/resolvers run before the redirect
// discards the render.
export const probeResolver = () => {
  console.log('  [RESOLVER RAN] a backend call would have happened here');
  return true;
};

// The canonical application-side open-redirect check, returning a UrlTree.
export const returnUrlGuard = (route: ActivatedRouteSnapshot) => {
  const target = route.queryParamMap.get('returnUrl') ?? '/';
  if (!target.startsWith('/') || target.startsWith('//')) {
    console.log(`  [GUARD] rejected ${JSON.stringify(target)}`);
    return true;
  }
  console.log(`  [GUARD] accepted ${JSON.stringify(target)}`);
  return inject(Router).parseUrl(target);
};

const withFallback = [
  { path: '', component: Home },
  { path: '**', component: Page },
];

export const routes: Routes = [
  { path: '', component: Home },

  // returnUrl / mitigation-bypass section of the issue
  { path: 'login', component: Login, canActivate: [returnUrlGuard] },

  // --- reachability table: the shapes that do NOT escape ---
  { path: 'users/:id', component: Layout },
  { path: 'tabs/:id', component: Layout, children: [{ path: '', component: Home }] },
  {
    path: 'legacy/:id',
    component: Layout,
    children: [{ path: '', component: Home }, { path: '**', redirectTo: '' }],
  },
  { path: 'shop/products/:id', component: Layout, children: withFallback },

  // --- reachability table: the shapes that DO escape ---
  {
    path: 'lazy/:id',
    component: Layout,
    loadChildren: () => Promise.resolve(withFallback),
  },

  // The main vector. Must stay last so it does not shadow the routes above.
  {
    path: ':tenant',
    component: Layout,
    resolve: { probe: probeResolver },
    children: withFallback,
  },

  { path: '**', component: Page },
];
