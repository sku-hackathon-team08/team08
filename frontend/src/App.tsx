import { createBrowserRouter, Link, Outlet, RouterProvider } from 'react-router-dom'

function RootLayout() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <nav className="flex gap-4 border-b border-white/10 px-6 py-4">
        <Link
          to="/"
          className="rounded-lg px-3 py-1.5 font-medium text-sky-300 hover:bg-white/10"
        >
          Home (/)
        </Link>
        <Link
          to="/example"
          className="rounded-lg px-3 py-1.5 font-medium text-emerald-300 hover:bg-white/10"
        >
          Example (/example)
        </Link>
      </nav>
      <Outlet />
    </div>
  )
}

function Home() {
  return (
    <div className="grid place-items-center px-6 py-24">
      <h1 className="rounded-xl bg-white/10 px-6 py-4 text-3xl font-bold tracking-tight text-sky-300">
        Home 화면 (/)
      </h1>
    </div>
  )
}

function Example() {
  return (
    <div className="grid place-items-center px-6 py-24">
      <h1 className="rounded-xl bg-white/10 px-6 py-4 text-3xl font-bold tracking-tight text-emerald-300">
        Example 화면 (/example)
      </h1>
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'example', element: <Example /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
