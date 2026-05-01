

export default function RootLayout({children}) {
  return (<>
    <html lang="en">
      <body className="bg-gray-600" >
        {children}
      </body>
    </html>
  </>);
}