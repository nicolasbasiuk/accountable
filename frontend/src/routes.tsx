import { createBrowserRouter, type RouteObject } from 'react-router'
import { ContactPage } from './contacts/ContactPage'
import { ContactsPage } from './contacts/ContactsPage'
import { DashboardPage } from './dashboard/DashboardPage'
import { DealPage } from './deals/DealPage'
import { DealsPage } from './deals/DealsPage'
import { Frame } from './Frame'
import { OrganizationPage } from './organizations/OrganizationPage'
import { OrganizationsPage } from './organizations/OrganizationsPage'
import { PipelinePage } from './pipeline/PipelinePage'
import { Broken, NotFound } from './shared/states'

// Every page is imported here, none when it's first opened. Otherwise Vite reloads the page when it meets a new package.
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Frame />,
    errorElement: <Broken />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'organizations', element: <OrganizationsPage /> },
      { path: 'organizations/:id', element: <OrganizationPage /> },
      { path: 'contacts', element: <ContactsPage /> },
      { path: 'contacts/:id', element: <ContactPage /> },
      { path: 'deals', element: <DealsPage /> },
      { path: 'deals/:id', element: <DealPage /> },
      { path: 'pipeline', element: <PipelinePage /> },
      { path: '*', element: <NotFound what="There's no page at this address" listName="the dashboard" listPath="/" /> },
    ],
  },
]

export const createRouter = () => createBrowserRouter(routes)
