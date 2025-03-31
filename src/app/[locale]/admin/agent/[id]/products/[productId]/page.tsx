"use client";

import React, { useState, useCallback, useRef, useEffect, useContext } from "react";
import { FormProvider, useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { ProductVariantRow } from "@/components/product-variant-row";
import { FileUploadStatus, UploadedFile, Product, ProductImage, Attachment, defaultProductSku, defaultVariantSku } from "@/data/client/models";
import { useProductContext } from "@/contexts/product-context";
import { getCurrentTS, getErrorMessage } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@radix-ui/react-tabs";
import { useAgentContext } from "@/contexts/agent-context";
import { ImageIcon, MoveLeftIcon, TrashIcon, WandIcon } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { AttachmentApiClient } from "@/data/client/attachment-api-client";
import { DatabaseContext } from "@/contexts/db-context";
import { SaaSContext } from "@/contexts/saas-context";
import { ProductDTO, StorageSchemas } from "@/data/dto";
import ZoomableImage from "@/components/zoomable-image";
import { set } from "date-fns";
import { ProductApiClient } from "@/data/client/product-api-client";
import DataLoader from "@/components/data-loader";


// ----------------------------------------------------
// 1) Zod validation schema
// ----------------------------------------------------

const attributeFormSchema = z.object({
  attrName: z.string().nonempty("Attribute name is required"),
  attrType: z.enum(["text", "select"]),
  attrValues: z.string().optional(), 
  // Note: this is a raw input field; in the database, if "select", we will create an array
  //       if "text", we will save a single entry in values
});

const variantAttributeSchema = z.object({
  attributeName: z.string().nonempty(),
  attributeValue: z.string().nonempty(),
});

const variantFormSchema = z.object({
  sku: z.string().nonempty("SKU is required"),
  name: z.string().nonempty("Variant name is required"),
  price: z.number().min(0, "Price must be >= 0"),
  priceInclTax: z.number().min(0, "Price incl. tax must be >= 0"),
  taxRate: z.number().min(0).max(100),
  variantAttributes: z.array(variantAttributeSchema),
});

const productFormSchema = z.object({
  name: z.string().nonempty("Name is required"),
  description: z.string().optional(),
  sku: z.string().nonempty("SKU is required"),

  price: z.number().min(0, "Price (net) must be >= 0"),
  priceInclTax: z.number().min(0, "Price (incl. tax) must be >= 0"),
  taxRate: z.number().min(0).max(100),

  currency: z.string().nonempty(),

  attributes: z.array(attributeFormSchema),
  tags: z.string().optional(),

  variants: z.array(variantFormSchema),
});

type ProductFormData = z.infer<typeof productFormSchema>;

// ----------------------------------------------------
// 2) Currencies
// ----------------------------------------------------
const FAVOURITE_CURRENCIES = ["EUR", "USD", "PLN", "GBP", "CHF"];
const ALL_CURRENCIES = [
  "AED","AFN","ALL","AMD","ANG","AOA","ARS","AUD","AWG","AZN","BAM","BBD","BDT","BGN","BHD","BIF","BMD","BND","BOB","BRL","BSD","BTN","BWP","BYN","BZD",
  "CAD","CDF","CLP","CNY","COP","CRC","CUP","CVE","CZK","DJF","DKK","DOP","DZD","EGP","ERN","ETB","FJD","FKP","GEL","GGP","GHS","GIP","GMD","GNF","GTQ",
  "GYD","HKD","HNL","HRK","HTG","HUF","IDR","ILS","IMP","INR","IQD","IRR","ISK","JEP","JMD","JOD","JPY","KES","KGS","KHR","KMF","KPW","KRW","KWD","KYD",
  "KZT","LAK","LBP","LKR","LRD","LSL","LYD","MAD","MDL","MGA","MKD","MMK","MNT","MOP","MRU","MUR","MVR","MWK","MXN","MYR","MZN","NAD","NGN","NIO","NOK",
  "NPR","NZD","OMR","PAB","PEN","PGK","PHP","PKR","QAR","RON","RSD","RUB","RWF","SAR","SBD","SCR","SDG","SEK","SGD","SHP","SLL","SOS","SPL","SRD","STN",
  "SVC","SYP","SZL","THB","TJS","TMT","TND","TOP","TRY","TTD","TVD","TWD","TZS","UAH","UGX","UYU","UZS","VEF","VND","VUV","WST","XAF","XCD","XDR","XOF",
  "XPF","YER","ZAR","ZMW","ZWD"
];
const sortedCurrencyList = [
  ...FAVOURITE_CURRENCIES,
  ...ALL_CURRENCIES.filter((c) => !FAVOURITE_CURRENCIES.includes(c)),
];


export default function ProductFormPage() {
  const { t, i18n } = useTranslation();
  const productContext = useProductContext();
  const dbContext = useContext(DatabaseContext);
  const saasContext = useContext(SaaSContext);
  const params = useParams();

  const agentContext = useAgentContext();
  const router = useRouter();

  // Default tax rates and currencies
  const defaultTaxRate = i18n.language === "pl" ? 23 : 0;
  const defaultCurrency = i18n.language === "pl" ? "PLN" : "USD";


  // 3a) Form initialization (Zod, default values)
  const methods = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      sku: defaultProductSku(),
      price: 0,
      priceInclTax: 0,
      taxRate: defaultTaxRate,
      currency: defaultCurrency,
      attributes: [],
      tags: "",
      variants: [],
    },
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { errors },
  } = methods;

  // 3b) Loading product for editing
  useEffect(() => {
    if (!params?.productId) return;
    if (params.productId !== "new") {
      loadProduct(params.productId);
    } else {
      // new
      reset();
    }
  }, [params?.productId]);


  async function loadProduct(productId: string) {
    try {
      const loadedDto = await productContext.loadProduct(productId);
      if (!loadedDto) {
        toast.error("Product not found!");
        return;
      }
      const formData: ProductFormData = mapDtoToFormData(loadedDto);
      reset(formData);
    } catch (err) {
      console.error(err);
      toast.error("Error loading product: " + getErrorMessage(err));
    }
  }

  // Function mapping ProductDTO -> ProductFormData
  function mapDtoToFormData(loadedDto: any, mapImages: boolean = true): ProductFormData {
    const taxRatePercent = (loadedDto.taxRate || 0) * 100;
    if (mapImages) {
      setImages(loadedDto.images || []);
      setDefaultImageUrl(loadedDto.imageUrl || null);
    }
    return {
      name: loadedDto.name || "",
      description: loadedDto.description || "",
      sku: loadedDto.sku || defaultProductSku(),
      price: loadedDto.price?.value || 0,
      priceInclTax: loadedDto.priceInclTax?.value || 0,
      taxRate: taxRatePercent > 100 ? 100 : taxRatePercent,
      currency: loadedDto.price?.currency || defaultCurrency,
      attributes: (loadedDto.attributes || []).map((a: any) => ({
        attrName: a.name,
        attrType: a.type,
        // merging values into a single string
        attrValues: a.values ? a.values.join(",") : "",
      })),
      tags: (loadedDto.tags || []).join(", "),
      variants: (loadedDto.variants || []).map((v: any) => ({
        sku: v.sku || defaultVariantSku(loadedDto),
        name: v.name || "",
        price: v.price?.value || 0,
        priceInclTax: v.priceInclTax?.value || 0,
        taxRate: (v.taxRate || 0) * 100,
        variantAttributes: v.variantAttributes || [],
      })),
    };
  }

  // 4) Handling attributes (useFieldArray)
  const {
    fields: attributeFields,
    append: appendAttribute,
    remove: removeAttribute,
  } = useFieldArray({ control, name: "attributes" });

  // 5) Handling variants (useFieldArray)
  const {
    fields: variantFields,
    append: appendVariant,
    remove: removeVariant,
  } = useFieldArray({ control, name: "variants" });

  // 5a) Generating variants from select-type attributes
  function generateVariantsFromAttributes() {
    const rawAttrs = watch("attributes");
    type SelectAttr = { attrName: string; values: string[] };
    const selectAttributes: SelectAttr[] = rawAttrs
      .filter((a) => a.attrType === "select")
      .map((a) => ({
        attrName: a.attrName,
        values: (a.attrValues || "")
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v.length > 0),
      }));

    if (!selectAttributes.length || selectAttributes.some((sa) => !sa.values.length)) {
      toast.error(t("No valid select attributes or empty values."));
      return;
    }

    const combos = buildVariantCombinations(selectAttributes);
    const defaultTax = watch("taxRate");

    combos.forEach((combo) => {
      const variantName = combo.map((x) => x.attributeValue).join(" / ");
      appendVariant({
        sku: defaultVariantSku(productFromFormData(methods.getValues())),
        name: variantName,
        price: mainPrice,
        priceInclTax: mainPriceInclTax,
        taxRate: mainTaxRate,
        variantAttributes: combo,
      });
    });
  }

  // Cartesian product
  function buildVariantCombinations(
    selectAttrs: { attrName: string; values: string[] }[],
    index = 0,
    current: { attributeName: string; attributeValue: string }[] = [],
    result: { attributeName: string; attributeValue: string }[][] = []
  ): { attributeName: string; attributeValue: string }[][] {
    if (index >= selectAttrs.length) {
      result.push(current);
      return result;
    }
    const { attrName, values } = selectAttrs[index];
    for (const val of values) {
      buildVariantCombinations(
        selectAttrs,
        index + 1,
        [...current, { attributeName: attrName, attributeValue: val }],
        result
      );
    }
    return result;
  }

  // 6) Bidirectional main price calculation
  const mainPrice = watch("price");
  const mainPriceInclTax = watch("priceInclTax");
  const mainTaxRate = watch("taxRate");
  const lastChangedMainField = useRef<"price" | "priceInclTax" | null>(null);

  const onChangeMainPrice = () => {
    lastChangedMainField.current = "price";
  };
  const onChangeMainPriceInclTax = () => {
    lastChangedMainField.current = "priceInclTax";
  };

  // Reaction: when mainPrice changes
  useEffect(() => {
    if (lastChangedMainField.current === "price") {
      const dec = mainTaxRate / 100;
      const newVal = mainPrice * (1 + dec);
      setValue("priceInclTax", parseFloat(newVal.toFixed(2)));
    }
  }, [mainPrice, mainTaxRate, setValue]);

  // Reaction: when mainPriceInclTax changes
  useEffect(() => {
    if (lastChangedMainField.current === "priceInclTax") {
      const dec = mainTaxRate / 100;
      const newVal = mainPriceInclTax / (1 + dec);
      setValue("price", parseFloat(newVal.toFixed(2)));
    }
  }, [mainPriceInclTax, mainTaxRate, setValue]);

  // 7) File upload
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [removedFiles, setRemovedFiles] = useState<UploadedFile[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [defaultImageUrl, setDefaultImageUrl] = useState<string | null>(null);
  const [aiProcessing, setAiProcessing] = useState(false);

  useEffect(() => {
    uploadedFiles.filter(uf=>images.map(im=>im.storageKey).indexOf(uf.dto?.storageKey) < 0).forEach((f) => {
      if (f.status === FileUploadStatus.SUCCESS && f.uploaded) {
        if (!defaultImageUrl) {
          setDefaultImageUrl(`${process.env.NEXT_PUBLIC_APP_URL}/storage/product/${dbContext?.databaseIdHash}/${f.dto?.storageKey}`);
        }
        setImages((prev) => [
          ...prev,
            {
              alt: f.dto?.displayName,
              url: `${process.env.NEXT_PUBLIC_APP_URL}/storage/product/${dbContext?.databaseIdHash}/${f.dto?.storageKey}`,
              storageKey: f?.dto?.storageKey,
            } as ProductImage,
        ]);
      }
    });
  }, [uploadedFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files).filter(f=>f.type.startsWith('image')).map((file) => ({
      id: nanoid(),
      file,
      status: FileUploadStatus.QUEUED,
      uploaded: false,
      dto: {
          displayName: file.name,
          description: '',
        
          mimeType: file.type,
          size: file.size,
          storageKey: uuidv4(),
        
          createdAt: getCurrentTS(),
          updatedAt: getCurrentTS(),                 
      }      
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    newFiles.forEach((f) => onUpload(f));
  };

  const removeFileFromQueue = useCallback((file: UploadedFile) => {
    setRemovedFiles([...removedFiles, file]);
    if(defaultImageUrl && defaultImageUrl?.indexOf(file.dto?.storageKey || '') > 0) setDefaultImageUrl(null);
    setImages((prev) => prev.filter((im) => im.storageKey !== file.dto?.storageKey));
    setUploadedFiles((prev) => prev.filter((f) => f.id !== file.id));
  }, []);

  const onUpload = useCallback(async (fileToUpload: UploadedFile) => {
    fileToUpload.status = FileUploadStatus.UPLOADING;
    setUploadedFiles((prev) => [...prev]);
    try {
      const formData = new FormData();
      formData.append("file", fileToUpload.file); 
      formData.append("attachmentDTO", JSON.stringify(fileToUpload.dto));
      const apiClient:AttachmentApiClient = new AttachmentApiClient('', StorageSchemas.Commerce, dbContext, saasContext, { useEncryption: false });

      try {
        const result = await apiClient.put(formData);
        if (result.status === 200) {
          console.log('Attachment saved', result);
          fileToUpload.status = FileUploadStatus.SUCCESS;
          fileToUpload.uploaded = true;
          fileToUpload.dto = result.data; // updated DTO
        } else {
          console.log("File upload error", result);
          toast.error(t("File upload error ") + t(result.message));
          fileToUpload.status = FileUploadStatus.ERROR;
        }
      } catch (error) {
        console.log("File upload error", error);
        toast.error('File upload error ' + getErrorMessage(error));
        fileToUpload.status = FileUploadStatus.ERROR;
      }
    
      setUploadedFiles((prev) => [...prev]);      
    } catch (error) {
      fileToUpload.status = FileUploadStatus.ERROR;
      setUploadedFiles((prev) => [...prev]);
      toast.error("File upload error: " + String(error));
    }
  }, []);


  const productFromFormData = (formData: ProductFormData): Product => {
    const decimalTaxRate = formData.taxRate / 100;

    return Product.fromForm({
      // If editing => params.productId
      id: (params?.productId && params.productId !== "new") ? params.productId : nanoid(),

      sku: formData.sku,
      name: formData.name,
      description: formData.description,

      price: { value: formData.price, currency: formData.currency },
      priceInclTax: { value: formData.priceInclTax, currency: formData.currency },
      taxRate: decimalTaxRate,

      images,

      imageUrl: defaultImageUrl || images[0]?.url || null,

      // Attributes
      attributes: formData.attributes.map((a) => {
        // interpretation of the a.attrValues field
        // - if select => it's an array of values
        // - if text => it's a 1-element array (we store it in values)
        let possibleVals: string[] = [];
        if (a.attrType === "select") {
          possibleVals = (a.attrValues || "")
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v.length > 0);
        } else {
            // type: text => we put one value into values 
            // (so that in the database in the "values" field we have what the user entered)
          if (a.attrValues && a.attrValues.trim().length > 0) {
            possibleVals = [a.attrValues.trim()];
          } else {
            possibleVals = [];
          }
        }
        return {
          name: a.attrName,
          type: a.attrType,
          values: possibleVals,
          defaultValue: possibleVals[0] || "",
        };
      }),

      // Tagi
      tags: (formData.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t),

      // Warianty
      variants: formData.variants.map((v) => ({
        id: nanoid(),
        sku: v.sku || nanoid(),
        name: v.name,
        price: { value: v.price, currency: formData.currency },
        priceInclTax: { value: v.priceInclTax, currency: formData.currency },
        taxRate: v.taxRate / 100,
        variantAttributes: v.variantAttributes,
      })),
    });
  }

  // 8) Submit
  const onSubmit = async (formData: ProductFormData, addNext: boolean) => {
    // Budujemy docelowy obiekt
    const newProduct = productFromFormData(formData);

    try {
      const saved = await productContext.updateProduct(newProduct, true);
      if (saved?.id) {
        toast.success(t("Product saved!"));

        const aac = new AttachmentApiClient('', StorageSchemas.Commerce, dbContext, saasContext, { useEncryption: false });

        console.log('Clearing removed attachments', removedFiles);
        removedFiles.forEach(async (attachmentToRemove) => {
          if (attachmentToRemove) {
            try {
              if(attachmentToRemove.dto) await aac.delete(attachmentToRemove.dto); // TODO: in case user last seconds cancels record save AFTER attachment removal it may cause problems that attachments are still attached to the record but not existient on the storage
            } catch (error) {
              toast.error('Error removing file from storage ' + error);
              console.error(error);
            }  
          }
        });
        setRemovedFiles([]); // clear form

        // assign attachments to product
        uploadedFiles?.filter(uf => uf !== null && uf.dto).map(uf => uf.dto).forEach(async (attachmentToUpdate) => {
          if (attachmentToUpdate && saved.id) {
            attachmentToUpdate.assignedTo = JSON.stringify([{ id: saved.id, type: "product" }]);
            await aac.put(attachmentToUpdate);
          }
        });         
        
        if (addNext) {
          router.push(`/admin/agent/${agentContext?.current?.id}/products/new`);          
        } else {
          router.push(`/admin/agent/${agentContext?.current?.id}/products`);                    
        }
      } else {
        toast.error("Error saving product");
      }
    } catch (error) {
      toast.error(t("Error saving product: ") + t(getErrorMessage(error)));
      console.error(error);
    }
  };

  return (
    <FormProvider {...methods}>
      <div className="max-w-4xl mx-auto">
      <Button className="mb-6" size="sm" variant="outline" onClick={() => history.back()}><MoveLeftIcon /> {t('Back to products')}</Button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit((data) => onSubmit(data, false))();
          }}
        >

        {productContext.loaderStatus === 'loading' ? (
          
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center">
              <DataLoader />
            </div>
          
          ) : (null) }

        <Tabs defaultValue="basic">
           <TabsList className="grid grid-cols-2">
             <TabsTrigger value="basic" className="dark:data-[state=active]:bg-zinc-900 data-[state=active]:bg-zinc-100 data-[state=active]:text-gray-200 p-2 rounded-md text-sm">{t('Basic')}</TabsTrigger>
             <TabsTrigger value="advanced" className="dark:data-[state=active]:bg-zinc-900 data-[state=active]:bg-zinc-100 data-[state=active]:text-gray-200 p-2 rounded-md text-sm">{t('Advanced')}</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="p-4 text-sm space-y-4">

            {/* NAME */}
            <div>
              <label className="block font-medium mb-1">{t('Name')}</label>
              <Input
              autoFocus 
                {...register("name")}
                placeholder={t("Product name...")}
              />
              {errors.name && (
                <p className="text-red-500 text-sm">{t(errors.name.message || '')}</p>
              )}
            </div>

            {/* IMAGES GRID */}
            <div>
              <label className="block font-medium mb-2">{t('Images')}</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {images.map((image, index) => (
                  <div key={index} className={`w-36 h-36 ${defaultImageUrl === image.url ? 'border-4 border-blue-500' : ''}`}>
                    <ZoomableImage src={image.url} alt={image.alt} className="cursor-pointer w-full h-full object-cover" />
                      <Button variant={"outline"} size="icon" className="relative top-[-38px] left-[2px]" onClick={(e) => {
                        e.preventDefault();
                        if(defaultImageUrl && defaultImageUrl?.indexOf(image.storageKey || '') > 0) setDefaultImageUrl(null);
                        setImages((prev) => prev.filter((im) => im.storageKey !== image.storageKey));
                        const ufo = uploadedFiles.find((f) => f.dto?.storageKey === image.storageKey);
                        if (ufo) {
                          setUploadedFiles((prev) => prev.filter((f) => f.id !== ufo.id));
                          setRemovedFiles((prev) => [...prev, ufo]);
                        }
                      }}>
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                    <Button title={t('Set as default image')} variant={"outline"} size="icon" className="relative top-[-38px] left-[4px]" onClick={(e) => {
                      e.preventDefault();
                      setDefaultImageUrl(image.url);
                    }}>
                      <ImageIcon className="w-4 h-4" />
                    </Button>

                    {aiProcessing ? (
                        <Button disabled size="icon" className="relative top-[-38px] left-[6px]"> 
                          <svg className="size-5 animate-spin text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>                        
                        </Button>                          
                    ) : (
                      <Button title={t('AI: Auto describe product')} variant={"outline"} size="icon" className="relative top-[-38px] left-[6px]" onClick={(e) => {
                        e.preventDefault();
                        const cl = new ProductApiClient('', dbContext, saasContext);
                        setAiProcessing(true)
                        const prd:Product = productFromFormData(methods.getValues());
                        if (!prd.name) prd.name = 'New Product';
              
                        if (image.storageKey) cl.describe(prd, image.storageKey, i18n.language).then((result) => {
                          setAiProcessing(false);
                          const formData: ProductFormData = mapDtoToFormData(result, false);
                          reset(formData);
                        }).catch(e => {
                          console.error(e);
                          toast.error(t(getErrorMessage(e)));
                        });
                      }}>
                        <WandIcon className="w-4 h-4" />
                      </Button>          
                    )}            
                  </div>
                ))}
              </div>
            </div>

            {/* FILES UPLOAD */}
            <div>
              <label className="block font-medium mb-2">{t('Add images')}</label>
              <Input type="file" accept="image/*" multiple onChange={handleFileSelect} />
              <div className="mt-2 space-y-2">
                {uploadedFiles.map((f) => (
                  <div key={f.id} className="flex items-center gap-2">
                    <span className="flex-1">
                      {f.file.name} - {f.status}
                    </span>
                    {f.status === FileUploadStatus.ERROR && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onUpload(f)}
                      >
                        {t('Retry')}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeFileFromQueue(f)}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>            

            {/* DESCRIPTION */}
            <div>
              <label className="block font-medium mb-1">{t('Description')}</label>
              <Textarea
                rows={8}
                {...register("description")}
                placeholder={t("Describe your product...")}
              />
              {errors.description && (
                <p className="text-red-500 text-sm">
                  {t(errors.description.message as string)}
                </p>
              )}
            </div>

            {/* SKU */}
            <div>
              <label className="block font-medium mb-1">{t('Product SKU')}</label>
              <Input
                {...register("sku")}
                placeholder={t("SKU...")}
              />
              {errors.sku && (
                <p className="text-red-500 text-sm">
                  {t(errors.sku.message as string)}
                </p>
              )}
            </div>

            {/* PRICE / TAX */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block font-medium mb-1">{t('Price (net)')}</label>
                <Input
                  type="number"
                  step="0.01"
                  {...register("price", { valueAsNumber: true })}
                  onKeyDown={(e) => {
                    // user changes price => remember it in lastChangedMainField
                    lastChangedMainField.current = "price";
                  }}
                  onMouseDown={() => {
                    // user changes price => remember it in lastChangedMainField
                    lastChangedMainField.current = "price";
                  }}
                />
                {errors.price && (
                  <p className="text-red-500 text-sm">
                    {errors.price.message as string}
                  </p>
                )}
              </div>
              <div className="flex-1">
                <label className="block font-medium mb-1">{t('Price (incl. tax)')}</label>
                <Input
                  type="number"
                  step="0.01"
                  {...register("priceInclTax", { valueAsNumber: true })}
                  onMouseDown={() => {
                    lastChangedMainField.current = "priceInclTax";
                  }} 
                  onKeyDown={() => {
                    lastChangedMainField.current = "priceInclTax";
                  }}
                />
                {errors.priceInclTax && (
                  <p className="text-red-500 text-sm">
                    {t(errors.priceInclTax.message as string)}
                  </p>
                )}
              </div>
              <div className="flex-1">
                <label className="block font-medium mb-1">{t('Tax Rate (%)')}</label>
                <Input
                  type="number"
                  step="1"
                  {...register("taxRate", { valueAsNumber: true })}
                />
                {errors.taxRate && (
                  <p className="text-red-500 text-sm">
                    {t(errors.taxRate.message as string)}
                  </p>
                )}
              </div>
              <div className="flex-1">
                <label className="block font-medium mb-1">{t('Currency')}</label>
                <select className="border rounded p-2 w-full" {...register("currency")}>
                  {sortedCurrencyList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {errors.currency && (
                  <p className="text-red-500 text-sm">
                    {t(errors.currency.message as string)}
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="advanced" className="p-4 text-sm space-y-4">
            {/* ATTRIBUTES */}
            <div>
              <label className="block font-medium mb-2">{t('Attributes')}</label>
              {attributeFields.map((field, i) => (
                <div key={field.id} className="flex gap-2 mb-2">
                  <Input
                    {...register(`attributes.${i}.attrName`)}
                    placeholder={t("Attribute name")}
                  />
                  <select
                    className="border rounded p-2"
                    {...register(`attributes.${i}.attrType`)}
                  >
                    <option value="text">{t('Text')}</option>
                    <option value="select">{t('Select')}</option>
                  </select>
                  <Input
                    {...register(`attributes.${i}.attrValues`)}
                    placeholder={t("Values (comma-separated for select; single text otherwise)")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeAttribute(i)}
                  >
                      <TrashIcon className="w-4 h-4" />
                   </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  appendAttribute({
                    attrName: "",
                    attrType: "text",
                    attrValues: "",
                  })
                }
              >
                {t('+ Add attribute')}
              </Button>
            </div>



            {/* VARIANTS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block font-medium">{t('Variants')}</label>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={generateVariantsFromAttributes}
                >
                  <WandIcon className="w-4 h-4 mr-2" />
                  {t('Generate variants')}
                </Button>
              </div>
              {variantFields.map((field, idx) => (
                <ProductVariantRow
                  key={field.id}
                  field={field}
                  index={idx}
                  removeVariant={removeVariant}
                />
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  appendVariant({
                    sku: defaultVariantSku(productFromFormData(methods.getValues())),
                    name: "",
                    price: 0,
                    priceInclTax: 0,
                    taxRate: defaultTaxRate,
                    variantAttributes: [],
                  })
                }
              >
                {t('+ Add Variant')}
              </Button>
            </div>


            {/* TAGS */}
            <div>
              <label className="block font-medium mb-2">{t('Tags (comma separated)')}</label>
              <Input {...register("tags")} placeholder={t("e.g. 'new, sale, featured'")} />
              {errors.tags && (
                <p className="text-red-500 text-sm">
                  {t(errors.tags.message as string)}
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

          {/* PRZYCISKI */}
          <div className="flex gap-4 mt-6">
            <Button type="submit" variant="default" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              {t('Save')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                handleSubmit((data) => onSubmit(data, true))();
              }}
            >
              {t('Save and add next')}
            </Button>
          </div>
        </form>
      </div>
    </FormProvider>
  );
}
