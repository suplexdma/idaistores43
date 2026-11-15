"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const categorySchema = z.object({
  name: z.string().trim().min(1, "Enter a category name.").max(100),
  slug: z
    .string()
    .trim()
    .min(1, "Enter a category slug.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens."),
  parentCategory: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
});

type CategoryValues = z.infer<typeof categorySchema>;

type CategoryOption = { id: string; name: string; parentCategoryId?: string };

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function CategoryCreateDialog({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const slugManuallyEdited = useRef(false);
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState("");
  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", slug: "", parentCategory: null },
  });

  async function onSubmit(values: CategoryValues) {
    setServerError("");
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          parentCategory: values.parentCategory || null,
        }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) {
        setServerError(result.error ?? "Unable to create category.");
        return;
      }
      form.reset();
      slugManuallyEdited.current = false;
      setOpen(false);
      router.refresh();
    } catch {
      setServerError("Unable to reach the category service. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus aria-hidden="true" className="mr-2 size-4" />Add category</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create category</DialogTitle>
          <DialogDescription>
            Add a parent category or choose a parent to create a child category.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(event) => {
                        field.onChange(event);
                        if (!slugManuallyEdited.current) {
                          form.setValue("slug", slugify(event.target.value), { shouldValidate: true });
                        }
                      }}
                    />
                    <FormField
                      control={form.control}
                      name="parentCategory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parent category</FormLabel>
                          <FormControl>
                            <select
                              ref={field.ref}
                              name={field.name}
                              value={field.value ?? ""}
                              onBlur={field.onBlur}
                              onChange={(event) => field.onChange(event.target.value || null)}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="">None — create a parent category</option>
                              {categories.filter((category) => !category.parentCategoryId).map((category) => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                              ))}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(event) => {
                        slugManuallyEdited.current = event.target.value.length > 0;
                        field.onChange(slugify(event.target.value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating..." : "Create category"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
