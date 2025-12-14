# NxtMarket — Functional Requirements

## Roles

- **Guest**: View the catalog and product detail pages.
- **User**: Register, login via JWT; place orders; view own orders; leave reviews for products.
- **Vendor**: Create, update, and delete products; upload images; import products via CSV; update order status.
- **Admin**: All vendor capabilities plus access to logs and application health metrics.

## Features

1. **Catalog (MongoDB)**: Search and filter products; view product details; add reviews.
2. **Orders (SQL)**: Create orders; adjust stock; send real-time updates.
3. **Authentication (JWT)**: Register and login; role-based access control.
4. **Filesystem**: Upload images; import CSV files; maintain logs and stream logs to admin.
5. **Core HTTP**: Serve health and metrics endpoints using Node’s core `http` module.
6. **Templates**: Use plain HTML templates with token replacement for server-side rendering.
7. **Real-Time**: Notify users and vendors about order status changes and low-stock alerts via WebSockets.
8. **Bonus**: Add Redis caching for product listing and detail endpoints.
