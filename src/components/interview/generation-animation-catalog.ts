import growingIconsAnimation from "@/assets/animations/growing-icons.json";
import plantRealisticAnimation from "@/assets/animations/plant-realistic.json";
import plantStoryAnimation from "@/assets/animations/plant-story.json";

export type GenerationAnimationId = "plant_story" | "plant_realistic" | "growing_icons";

export interface GenerationAnimationEntry {
  id: GenerationAnimationId;
  label: string;
  source: string;
  animationData: unknown;
}

export type GenerationAnimationMode = "dimension" | "daily";

const generationAnimationCatalog: Record<GenerationAnimationId, GenerationAnimationEntry> = {
  plant_story: {
    id: "plant_story",
    label: "Plant Story",
    source: "https://assets2.lottiefiles.com/packages/lf20_5njp3vgg.json",
    animationData: plantStoryAnimation
  },
  plant_realistic: {
    id: "plant_realistic",
    label: "Plant Realistic",
    source: "https://assets2.lottiefiles.com/packages/lf20_Bom6gU.json",
    animationData: plantRealisticAnimation
  },
  growing_icons: {
    id: "growing_icons",
    label: "Growing Icons",
    source: "https://assets2.lottiefiles.com/packages/lf20_qp1q7mct.json",
    animationData: growingIconsAnimation
  }
};

const modeDefaults: Record<GenerationAnimationMode, GenerationAnimationId> = {
  dimension: "plant_story",
  daily: "growing_icons"
};

export function resolveGenerationAnimation(input: {
  mode: GenerationAnimationMode;
  id?: GenerationAnimationId;
}): GenerationAnimationEntry {
  const selectedId = input.id ?? modeDefaults[input.mode];
  return generationAnimationCatalog[selectedId];
}
