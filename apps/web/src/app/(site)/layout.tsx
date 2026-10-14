// The website's own pages (log in, dashboard, activities, download) sit in one readable
// column. The landing page (app/page.tsx) is outside this group because it runs edge to edge.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>;
}
