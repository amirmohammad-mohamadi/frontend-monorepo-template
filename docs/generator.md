# Domain generator

```bash
npm run generate:domain -- product
npm run generate:domain -- blog-post --plural=blog-posts --endpoint=/api/v1/posts --adminPage=false
```

For a domain `product` it writes:

```
libs/dtos/src/lib/product/product.dto.ts          schemas: product, createProduct, updateProduct, listProductsQuery
libs/models/src/lib/product/product.{interface,model}.ts
libs/services/src/lib/product/product.{api,hooks,query-keys}.ts
apps/admin/src/app/(dashboard)/products/page.tsx  (unless --adminPage=false)
apps/admin/src/features/products/products-table.{tsx,hook.ts}
```

and edits:

- the three lib barrels (`libs/*/src/index.ts`) to export the new folder,
- `libs/services/src/lib/shared/endpoints.ts` to add `product: { list, byId }`.

Then by hand: the real fields in the DTO and the model, the admin table columns, and a navigation entry in `apps/admin/src/config/navigation.ts`. The `example` domain is the finished version of what the generator produces; read it before editing the output.

The templates live in `tools/generators/domain/files`. Change them when a convention changes, so new domains follow suit; the generator is the executable form of the architecture.
