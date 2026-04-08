export interface SelectionOption {
  value: string;
  label: string;
  description?: string;
}

export const PLATFORM_PAGES: Record<string, SelectionOption[]> = {
  facebook: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Rebar.shop", label: "Rebar.shop" },
    { value: "Ontario Digital Marketing", label: "Ontario Digital Marketing" },
    { value: "Ontario Logistics", label: "Ontario Logistics" },
    { value: "Ontario Steels", label: "Ontario Steels" },
    { value: "Rebar.shop Ontario", label: "Rebar.shop Ontario" },
  ],
  instagram: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Rebar.shop", label: "Rebar.shop" },
    { value: "Ontario Digital Marketing", label: "Ontario Digital Marketing" },
    { value: "Ontario Logistics", label: "Ontario Logistics" },
    { value: "Ontario Steels", label: "Ontario Steels" },
    { value: "Rebar.shop Ontario", label: "Rebar.shop Ontario" },
  ],
  linkedin: [
    { value: "Sattar Esmaeili-Oureh", label: "Sattar Esmaeili-Oureh (Personal)" },
    { value: "Rebar.shop Ontario", label: "Rebar.shop Ontario" },
    { value: "Rebar.shop", label: "Rebar.shop" },
  ],
  youtube: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
  ],
  tiktok: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
  ],
};

export const PIXEL_APPROVE_PLATFORMS = ["facebook", "instagram"] as const;
