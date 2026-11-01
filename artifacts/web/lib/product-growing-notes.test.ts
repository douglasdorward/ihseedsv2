import assert from "node:assert/strict";
import test from "node:test";
import { productGrowingNotes } from "./product-growing-notes";

test("growing notes keep the default order, then custom sections in saved order", () => {
  const notes = productGrowingNotes({
    standLifeNotes: "Lasts five years.",
    grazingManagementNotes: "Graze at the three-leaf stage.",
    diseasePestResistance: "Tolerant of RLEM.",
    carbonFarmingNotes: "Deep roots build soil carbon.",
    customSections: [
      { title: "Establishment tips", body: "Roll after sowing." },
      { title: "Hay quality", body: "Cut at early flowering." },
    ],
  });
  assert.deepEqual(notes.map((note) => note.title), [
    "Planting & grazing notes",
    "Disease & pest resistance",
    "Stand life",
    "Carbon Farming & Pasture Diversity",
    "Establishment tips",
    "Hay quality",
  ]);
});

test("empty sections and untitled custom sections are hidden", () => {
  const notes = productGrowingNotes({
    grazingManagementNotes: "  ",
    standLifeNotes: "",
    carbonFarmingNotes: "Diverse swards.",
    customSections: [
      { title: "", body: "No title." },
      { title: "No text", body: " " },
      { title: "  Kept  ", body: " Shown. " },
    ],
  });
  assert.deepEqual(notes, [
    { title: "Carbon Farming & Pasture Diversity", body: "Diverse swards." },
    { title: "Kept", body: "Shown." },
  ]);
  assert.deepEqual(productGrowingNotes(undefined), []);
});
