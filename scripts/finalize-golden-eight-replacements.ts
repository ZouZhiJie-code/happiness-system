import { finalizeGoldenEightReview } from "@/app/admin/journal-evaluation/golden-eight-loader";

const receipt = await finalizeGoldenEightReview();
console.log(JSON.stringify(receipt, null, 2));
