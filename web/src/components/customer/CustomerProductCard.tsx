import { useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { Minus, Plus } from 'lucide-react';

import { toast } from 'sonner';

import { useCart } from '@/hooks/useCart';

import { getOptionEffectivePrice } from '@/lib/formatting';

import {

  getProductCardPrice,

  getProductPurchaseOptions,

  getSoleVariant,

  productHasVariantChoices,

  resolveCartVariantId,

  resolveSelectedVariant,

} from '@/lib/productVariants';

import ProductVariantPicker, { formatCardPrice } from '@/components/customer/ProductVariantPicker';

import { cn } from '@/lib/utils';

import type { Product, ProductPurchaseOption } from '@/types';



export type CustomerProductCardLayout = 'scroll' | 'grid';



type CustomerProductCardProps = {

  product: Product;

  layout?: CustomerProductCardLayout;

};



export default function CustomerProductCard({

  product,

  layout = 'scroll',

}: CustomerProductCardProps) {

  const { cart, addProduct, setLineQuantity } = useCart();

  const purchaseOptions = useMemo(() => getProductPurchaseOptions(product), [product]);

  const hasOptions = productHasVariantChoices(product);

  const soleVariant = useMemo(() => getSoleVariant(product), [product]);

  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);



  useEffect(() => {

    if (!hasOptions) {

      setSelectedVariantId(null);

      return;

    }

    setSelectedVariantId(prev => {

      if (prev != null && purchaseOptions.some(opt => opt.variant_id === prev)) return prev;

      return purchaseOptions[0]?.variant_id ?? null;

    });

  }, [hasOptions, purchaseOptions]);



  const selectedOption = useMemo((): ProductPurchaseOption | null => {

    if (!hasOptions) return null;

    return (

      purchaseOptions.find(opt => opt.variant_id === selectedVariantId) ?? purchaseOptions[0] ?? null

    );

  }, [hasOptions, purchaseOptions, selectedVariantId]);



  const selectedVariant = useMemo(

    () => resolveSelectedVariant(product, selectedOption, selectedVariantId),

    [product, selectedOption, selectedVariantId],

  );



  const variantId = resolveCartVariantId(product, selectedVariantId, selectedOption);

  const effective = getProductCardPrice(product, selectedOption, soleVariant);



  const findLine = (asPreorder?: boolean) =>

    cart?.items?.find(

      i =>

        i.product_id === product.id &&

        (i.variant_id ?? null) === (variantId ?? null) &&

        Boolean(i.is_preorder) === Boolean(asPreorder),

    );



  const line = findLine(false) ?? findLine(true);

  const qty = line?.quantity ?? 0;

  const lineIsPreorder = Boolean(line?.is_preorder);



  const adjustCartQty = (delta: number, asPreorder?: boolean) => {

    if (hasOptions && selectedOption == null) {

      toast.error('Choose a variant before adding to cart.');

      return;

    }

    const preorder = asPreorder ?? lineIsPreorder;

    const activeLine = findLine(preorder);

    const nextQty = (activeLine?.quantity ?? 0) + delta;

    if (nextQty < 1) {

      if (activeLine) setLineQuantity.mutate({ item: activeLine, quantity: 0, product });

      return;

    }

    if (!activeLine) {

      addProduct.mutate({

        product,

        quantity: nextQty,

        is_preorder: preorder,

        variant_id: variantId,

        variant: selectedVariant,

        unit_price: effective,

      });

    } else {

      setLineQuantity.mutate({ item: activeLine, quantity: nextQty, product });

    }

  };



  const thumb = product.thumbnail_url || product.images?.[0]?.image_url;

  const isScroll = layout === 'scroll';

  const singlePrice = soleVariant

    ? getOptionEffectivePrice({

        effective_price: soleVariant.effective_price,

        price: soleVariant.price,

      })

    : effective;



  return (

    <div

      className={cn(

        'bg-white rounded-[15px] border border-neutral-200/80 overflow-hidden shadow-sm flex flex-col',

        isScroll ? 'min-w-[172px] max-w-[200px]' : 'w-full',

      )}

    >

      <Link to={`/customer/product/${product.id}`} className="relative block shrink-0">

        {thumb ? (

          <img

            src={thumb}

            alt={product.name}

            className={cn('w-full object-cover rounded-t-[15px]', isScroll ? 'h-[120px]' : 'h-[110px]')}

          />

        ) : (

          <div

            className={cn(

              'w-full bg-neutral-100 flex items-center justify-center rounded-t-[15px]',

              isScroll ? 'h-[120px] text-3xl' : 'h-[110px] text-2xl',

            )}

          >

            🍬

          </div>

        )}

        {!product.is_veg ? (

          <span

            className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-600 ring-2 ring-white"

            aria-label="Non-vegetarian"

          />

        ) : null}

      </Link>



      <div className={cn('px-3 pb-3 pt-2.5 flex flex-col flex-1 gap-2', !isScroll && 'px-2.5')}>

        <Link to={`/customer/product/${product.id}`}>

          <h3

            className={cn(

              'font-bold text-neutral-900 truncate leading-tight',

              isScroll ? 'text-sm' : 'text-xs',

            )}

          >

            {product.name}

          </h3>

        </Link>



        {hasOptions ? (

          <ProductVariantPicker

            options={purchaseOptions}

            selectedVariantId={selectedVariantId}

            onSelect={setSelectedVariantId}

          />

        ) : (

          <>

            {product.short_description ? (

              <p className="text-[10px] leading-snug text-neutral-400 line-clamp-2">

                {product.short_description}

              </p>

            ) : null}

            <p className={cn('font-bold text-red-600', isScroll ? 'text-sm' : 'text-xs')}>

              {formatCardPrice(singlePrice)}

            </p>

          </>

        )}



        <div className="mt-auto pt-0.5">

          {qty > 0 ? (

            <div className="flex flex-col gap-1.5">

              {product.is_sweet && lineIsPreorder ? (

                <span className="text-[9px] font-semibold uppercase tracking-wide text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded self-center">

                  Pre-order

                </span>

              ) : null}

              <div className="flex items-center justify-center gap-3 rounded-full border border-red-200 bg-red-50 py-1.5">

                <button

                  type="button"

                  onClick={() => adjustCartQty(-1, lineIsPreorder)}

                  className="w-8 h-8 rounded-full bg-white text-red-600 flex items-center justify-center shadow-sm border border-red-100"

                  aria-label="Decrease quantity"

                >

                  <Minus size={16} />

                </button>

                <span className="text-sm font-bold text-red-600 w-5 text-center">{qty}</span>

                <button

                  type="button"

                  onClick={() => adjustCartQty(1, lineIsPreorder)}

                  className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center"

                  aria-label="Increase quantity"

                >

                  <Plus size={16} />

                </button>

              </div>

            </div>

          ) : product.is_sweet ? (

            <div className="flex flex-col gap-1.5">

              <button

                type="button"

                onClick={() => adjustCartQty(1, false)}

                className="w-full py-2 rounded-full bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors"

              >

                Add

              </button>

              <button

                type="button"

                onClick={() => adjustCartQty(1, true)}

                className="w-full py-1.5 rounded-full border border-violet-300 text-violet-800 text-[10px] font-semibold bg-violet-50 hover:bg-violet-100"

              >

                Pre-order

              </button>

            </div>

          ) : (

            <button

              type="button"

              onClick={() => adjustCartQty(1)}

              className="w-full py-2 rounded-full bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors"

            >

              Add

            </button>

          )}

        </div>

      </div>

    </div>

  );

}


