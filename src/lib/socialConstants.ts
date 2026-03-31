export interface SelectionOption {
  value: string;
  label: string;
  description?: string;
}

export const PLATFORM_PAGES: Record<string, SelectionOption[]> = {
  facebook: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Rebar.Shop Incorporated", label: "Rebar.Shop Incorporated" },
    { value: "Ontario Digital Marketing", label: "Ontario Digital Marketing" },
    { value: "Ontario Logistics", label: "Ontario Logistics" },
    { value: "Ontario Steels", label: "Ontario Steels" },
    { value: "Rebar.Shop Ontario", label: "Rebar.Shop Ontario" },
  ],
  instagram: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Rebar.Shop Incorporated", label: "Rebar.Shop Incorporated" },
    { value: "Ontario Digital Marketing", label: "Ontario Digital Marketing" },
    { value: "Ontario Logistics", label: "Ontario Logistics" },
    { value: "Ontario Steels", label: "Ontario Steels" },
    { value: "Rebar.Shop Ontario", label: "Rebar.Shop Ontario" },
  ],
  linkedin: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
    { value: "Ontario Logistics", label: "Ontario Logistics" },
  ],
  youtube: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
  ],
  tiktok: [
    { value: "Ontario Steel Detailing", label: "Ontario Steel Detailing" },
  ],
};

export const PIXEL_APPROVE_PLATFORMS = ["facebook", "instagram"] as const;
