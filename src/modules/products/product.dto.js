function toProductResponse(p) {
  return {
    id: String(p._id),
    sku: p.sku,
    title: p.title,
    description: p.description,
    price: p.price,
    stock: p.stock,
    vendorId: String(p.vendorId),
    images: p.images || [],
    categories: p.categories || [],
    ratingAvg: p.ratingAvg ?? 0,
    ratingCount: p.ratingCount ?? 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function toProductDetailsResponse(p) {
  const base = toProductResponse(p);
  return {
    ...base,
    reviews: (p.reviews || []).map((r) => ({
      userId: String(r.userId),
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  };
}

module.exports = { toProductResponse, toProductDetailsResponse };
