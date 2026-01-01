# NxtMarket — Description (What the app does)

- **Catalog & Product Detail**: Guests and users can browse a product catalog stored in MongoDB and open detailed product pages.
- **Orders**: Logged-in users place orders stored in SQL; each order snapshots the product price and title at purchase time.
- **Vendors**: Create and update products, upload product images, import products via CSV, and update order status.
- **Real-time notifications**: Users and vendors receive order status changes, and vendors receive low-stock alerts through WebSockets.
- **Plain HTML templates**: Views are rendered by replacing tokens in static HTML files rather than using a template engine like EJS.
