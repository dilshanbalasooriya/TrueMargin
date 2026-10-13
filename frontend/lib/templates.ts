import type { GuestDraft } from '@/store/useCalculatorStore';

export interface BusinessTemplate {
  id: string;
  nameKey: string;
  enName: string;
  siName: string;
  enDetails: string;
  siDetails: string;
  categoryKey: string;
  iconName: string;
  enDraft: GuestDraft;
  siDraft: GuestDraft;
  draft: GuestDraft;
}

export function getTemplateDraft(tmpl: BusinessTemplate, locale: string): GuestDraft {
  return locale === 'si' ? tmpl.siDraft : tmpl.enDraft;
}

export const BUSINESS_TEMPLATES: BusinessTemplate[] = [
  {
    id: 'rice-packet',
    nameKey: 'templateRicePacket',
    enName: 'Rice & Curry Packet',
    siName: 'බත් පාර්සලය',
    enDetails: '500 packets • Rice, Veggies, Meat, Labor & Gas',
    siDetails: 'පාර්සල් 500 • සහල්, එළවළු, මස්, කුලිය සහ ගෑස්',
    categoryKey: 'food',
    iconName: 'Utensils',
    enDraft: {
      productName: 'Rice & Curry Packet',
      kind: 'product',
      unitLabel: 'Packet',
      productionBasis: 'batch',
      unitsProduced: '500',
      defectiveUnits: '0',
      defaultUnitsCoveredScope: 'all',
      currencyCode: 'LKR',
      currencyOverridden: true,
      pricingType: 'margin',
      pricingPercentage: '25',
      buckets: {
        material: {
          totalSpent: '45000',
          unitsCovered: '500',
          isNone: false,
          items: [
            { id: '1', name: 'Rice (25kg)', amount: '6500', unitsCovered: '500' },
            { id: '2', name: 'Vegetables, Meat & Fish', amount: '28000', unitsCovered: '500' },
            { id: '3', name: 'Cooking Oil & Spices', amount: '6500', unitsCovered: '500' },
            { id: '4', name: 'Lunch Sheets & Boxes', amount: '4000', unitsCovered: '500' },
          ],
        },
        labor: {
          totalSpent: '12000',
          unitsCovered: '500',
          isNone: false,
          items: [
            { id: '5', name: 'Head Cook', amount: '7000', unitsCovered: '500' },
            { id: '6', name: 'Kitchen Helpers', amount: '5000', unitsCovered: '500' },
          ],
        },
        transport: {
          totalSpent: '3000',
          unitsCovered: '500',
          isNone: false,
          items: [
            { id: '7', name: 'Purchasing & Delivery Transport', amount: '3000', unitsCovered: '500' },
          ],
        },
        overhead: {
          totalSpent: '5000',
          unitsCovered: '500',
          isNone: false,
          items: [
            { id: '8', name: 'Cooking Gas & Electricity', amount: '5000', unitsCovered: '500' },
          ],
        },
        machinery: {
          totalSpent: '1000',
          unitsCovered: '500',
          isNone: false,
          items: [
            { id: '9', name: 'Cooker & Equipment Depreciation', amount: '1000', unitsCovered: '500' },
          ],
        },
        custom_fees: {
          totalSpent: '',
          unitsCovered: '',
          isNone: true,
          items: [],
        },
      },
    },
    siDraft: {
      productName: 'බත් පාර්සලය',
      kind: 'product',
      unitLabel: 'එක් බත් පාර්සලයක්',
      productionBasis: 'batch',
      unitsProduced: '500',
      defectiveUnits: '0',
      defaultUnitsCoveredScope: 'all',
      currencyCode: 'LKR',
      currencyOverridden: true,
      pricingType: 'margin',
      pricingPercentage: '25',
      buckets: {
        material: {
          totalSpent: '45000',
          unitsCovered: '500',
          isNone: false,
          items: [
            { id: '1', name: 'සහල් 25kg', amount: '6500', unitsCovered: '500' },
            { id: '2', name: 'එළවළු සහ මස්/මාළු', amount: '28000', unitsCovered: '500' },
            { id: '3', name: 'තෙල් සහ කුළුබඩු', amount: '6500', unitsCovered: '500' },
            { id: '4', name: 'දිවා ආහාර පෙට්ටි සහ ෂීට්', amount: '4000', unitsCovered: '500' },
          ],
        },
        labor: {
          totalSpent: '12000',
          unitsCovered: '500',
          isNone: false,
          items: [
            { id: '5', name: 'ප්‍රධාන කුක්', amount: '7000', unitsCovered: '500' },
            { id: '6', name: 'කුස්සි සහයකයින්', amount: '5000', unitsCovered: '500' },
          ],
        },
        transport: {
          totalSpent: '3000',
          unitsCovered: '500',
          isNone: false,
          items: [
            { id: '7', name: 'බඩු ප්‍රවාහනය', amount: '3000', unitsCovered: '500' },
          ],
        },
        overhead: {
          totalSpent: '5000',
          unitsCovered: '500',
          isNone: false,
          items: [
            { id: '8', name: 'ගෑස් සහ විදුලිය', amount: '5000', unitsCovered: '500' },
          ],
        },
        machinery: {
          totalSpent: '1000',
          unitsCovered: '500',
          isNone: false,
          items: [
            { id: '9', name: 'කුකර් / බ්ලෙන්ඩර් ක්ෂයවීම', amount: '1000', unitsCovered: '500' },
          ],
        },
        custom_fees: {
          totalSpent: '',
          unitsCovered: '',
          isNone: true,
          items: [],
        },
      },
    },
    get draft() {
      return this.siDraft;
    },
  },
  {
    id: 'tailored-shirt',
    nameKey: 'templateShirt',
    enName: 'Tailored Shirt',
    siName: 'මහන කමිසය',
    enDetails: '50 shirts • Fabric, Buttons, Tailoring & Power',
    siDetails: 'කමිස 50 • රෙදි, බොත්තම්, මැහුම් කුලිය සහ විදුලිය',
    categoryKey: 'garment',
    iconName: 'Scissors',
    enDraft: {
      productName: 'Tailored Shirt',
      kind: 'product',
      unitLabel: 'Shirt',
      productionBasis: 'batch',
      unitsProduced: '50',
      defectiveUnits: '0',
      defaultUnitsCoveredScope: 'all',
      currencyCode: 'LKR',
      currencyOverridden: true,
      pricingType: 'margin',
      pricingPercentage: '30',
      buckets: {
        material: {
          totalSpent: '55000',
          unitsCovered: '50',
          isNone: false,
          items: [
            { id: '11', name: 'Fabric (100 meters)', amount: '45000', unitsCovered: '50' },
            { id: '12', name: 'Buttons & Thread', amount: '5000', unitsCovered: '50' },
            { id: '13', name: 'Collar Interfacing & Canvas', amount: '5000', unitsCovered: '50' },
          ],
        },
        labor: {
          totalSpent: '25000',
          unitsCovered: '50',
          isNone: false,
          items: [
            { id: '14', name: 'Tailoring & Stitching Labor', amount: '25000', unitsCovered: '50' },
          ],
        },
        transport: {
          totalSpent: '2500',
          unitsCovered: '50',
          isNone: false,
          items: [
            { id: '15', name: 'Fabric & Material Transport', amount: '2500', unitsCovered: '50' },
          ],
        },
        overhead: {
          totalSpent: '6000',
          unitsCovered: '50',
          isNone: false,
          items: [
            { id: '16', name: 'Workshop Rent & Power', amount: '6000', unitsCovered: '50' },
          ],
        },
        machinery: {
          totalSpent: '2000',
          unitsCovered: '50',
          isNone: false,
          items: [
            { id: '17', name: 'Sewing Machine Maintenance', amount: '2000', unitsCovered: '50' },
          ],
        },
        custom_fees: {
          totalSpent: '',
          unitsCovered: '',
          isNone: true,
          items: [],
        },
      },
    },
    siDraft: {
      productName: 'මහන කමිසය',
      kind: 'product',
      unitLabel: 'එක් කමිසයක්',
      productionBasis: 'batch',
      unitsProduced: '50',
      defectiveUnits: '0',
      defaultUnitsCoveredScope: 'all',
      currencyCode: 'LKR',
      currencyOverridden: true,
      pricingType: 'margin',
      pricingPercentage: '30',
      buckets: {
        material: {
          totalSpent: '55000',
          unitsCovered: '50',
          isNone: false,
          items: [
            { id: '11', name: 'රෙදි මීටර් 100', amount: '45000', unitsCovered: '50' },
            { id: '12', name: 'බොත්තම් සහ නූල්', amount: '5000', unitsCovered: '50' },
            { id: '13', name: 'කොලර් කැන්වස්', amount: '5000', unitsCovered: '50' },
          ],
        },
        labor: {
          totalSpent: '25000',
          unitsCovered: '50',
          isNone: false,
          items: [
            { id: '14', name: 'මැහුම් කුලිය', amount: '25000', unitsCovered: '50' },
          ],
        },
        transport: {
          totalSpent: '2500',
          unitsCovered: '50',
          isNone: false,
          items: [
            { id: '15', name: 'රෙදි ගෙන ඒම', amount: '2500', unitsCovered: '50' },
          ],
        },
        overhead: {
          totalSpent: '6000',
          unitsCovered: '50',
          isNone: false,
          items: [
            { id: '16', name: 'වැඩපොළ විදුලිය සහ කුලිය', amount: '6000', unitsCovered: '50' },
          ],
        },
        machinery: {
          totalSpent: '2000',
          unitsCovered: '50',
          isNone: false,
          items: [
            { id: '17', name: 'මැහුම් මැෂින් නඩත්තුව', amount: '2000', unitsCovered: '50' },
          ],
        },
        custom_fees: {
          totalSpent: '',
          unitsCovered: '',
          isNone: true,
          items: [],
        },
      },
    },
    get draft() {
      return this.siDraft;
    },
  },
  {
    id: 'salon-service',
    nameKey: 'templateSalon',
    enName: 'Hair Styling & Treatment',
    siName: 'කොණ්ඩා සැකසුම් සේවාව',
    enDetails: '80 treatments • Shampoo, Serum, Stylist & Rent',
    siDetails: 'සේවා 80 • ෂැම්පු, සීරම්, ස්ටයිලිස්ට් වැටුප් සහ කුලිය',
    categoryKey: 'service',
    iconName: 'Sparkles',
    enDraft: {
      productName: 'Hair Styling & Treatment',
      kind: 'service',
      unitLabel: 'Treatment',
      productionBasis: 'monthly',
      unitsProduced: '80',
      defectiveUnits: '0',
      defaultUnitsCoveredScope: 'all',
      currencyCode: 'LKR',
      currencyOverridden: true,
      pricingType: 'margin',
      pricingPercentage: '35',
      buckets: {
        material: {
          totalSpent: '24000',
          unitsCovered: '80',
          isNone: false,
          items: [
            { id: '21', name: 'Shampoos & Conditioners', amount: '12000', unitsCovered: '80' },
            { id: '22', name: 'Hair Serum & Colors', amount: '12000', unitsCovered: '80' },
          ],
        },
        labor: {
          totalSpent: '40000',
          unitsCovered: '80',
          isNone: false,
          items: [
            { id: '23', name: 'Stylist Commission & Wages', amount: '40000', unitsCovered: '80' },
          ],
        },
        transport: {
          totalSpent: '',
          unitsCovered: '',
          isNone: true,
          items: [],
        },
        overhead: {
          totalSpent: '35000',
          unitsCovered: '80',
          isNone: false,
          items: [
            { id: '24', name: 'Salon Rent Share', amount: '25000', unitsCovered: '80' },
            { id: '25', name: 'A/C & Electricity', amount: '10000', unitsCovered: '80' },
          ],
        },
        machinery: {
          totalSpent: '4000',
          unitsCovered: '80',
          isNone: false,
          items: [
            { id: '26', name: 'Blow Dryers & Steamer Depreciation', amount: '4000', unitsCovered: '80' },
          ],
        },
        custom_fees: {
          totalSpent: '',
          unitsCovered: '',
          isNone: true,
          items: [],
        },
      },
    },
    siDraft: {
      productName: 'කොණ්ඩා සැකසුම',
      kind: 'service',
      unitLabel: 'එක් සේවාවක්',
      productionBasis: 'monthly',
      unitsProduced: '80',
      defectiveUnits: '0',
      defaultUnitsCoveredScope: 'all',
      currencyCode: 'LKR',
      currencyOverridden: true,
      pricingType: 'margin',
      pricingPercentage: '35',
      buckets: {
        material: {
          totalSpent: '24000',
          unitsCovered: '80',
          isNone: false,
          items: [
            { id: '21', name: 'ෂැම්පු සහ කන්ඩිෂනර්', amount: '12000', unitsCovered: '80' },
            { id: '22', name: 'හර් සීරම් සහ වර්ණක', amount: '12000', unitsCovered: '80' },
          ],
        },
        labor: {
          totalSpent: '40000',
          unitsCovered: '80',
          isNone: false,
          items: [
            { id: '23', name: 'ස්ටයිලිස්ට් වැටුප් සහ කොමිස්', amount: '40000', unitsCovered: '80' },
          ],
        },
        transport: {
          totalSpent: '',
          unitsCovered: '',
          isNone: true,
          items: [],
        },
        overhead: {
          totalSpent: '35000',
          unitsCovered: '80',
          isNone: false,
          items: [
            { id: '24', name: 'සැලෝන් කුලිය', amount: '25000', unitsCovered: '80' },
            { id: '25', name: 'A/C සහ විදුලි බිල', amount: '10000', unitsCovered: '80' },
          ],
        },
        machinery: {
          totalSpent: '4000',
          unitsCovered: '80',
          isNone: false,
          items: [
            { id: '26', name: 'බ්ලෝ ඩ්‍රයර් සහ ස්ටීමර් ක්ෂයවීම', amount: '4000', unitsCovered: '80' },
          ],
        },
        custom_fees: {
          totalSpent: '',
          unitsCovered: '',
          isNone: true,
          items: [],
        },
      },
    },
    get draft() {
      return this.siDraft;
    },
  },
  {
    id: 'bakery-item',
    nameKey: 'templateBakery',
    enName: 'Fish Bun (Bakery Pastry)',
    siName: 'මාළු පාන් (බේකරි නිෂ්පාදන)',
    enDetails: '300 buns • Flour, Fish filling, Baker & Oven',
    siDetails: 'මාළු පාන් 300 • පිටි, මාළු පිරවුම, බේකර් සහ උඳුන',
    categoryKey: 'bakery',
    iconName: 'Package',
    enDraft: {
      productName: 'Fish Bun',
      kind: 'product',
      unitLabel: 'Bun',
      productionBasis: 'batch',
      unitsProduced: '300',
      defectiveUnits: '0',
      defaultUnitsCoveredScope: 'all',
      currencyCode: 'LKR',
      currencyOverridden: true,
      pricingType: 'margin',
      pricingPercentage: '30',
      buckets: {
        material: {
          totalSpent: '18000',
          unitsCovered: '300',
          isNone: false,
          items: [
            { id: '31', name: 'Flour & Margarine', amount: '9000', unitsCovered: '300' },
            { id: '32', name: 'Fish & Vegetable Filling', amount: '7500', unitsCovered: '300' },
            { id: '33', name: 'Yeast & Seasoning', amount: '1500', unitsCovered: '300' },
          ],
        },
        labor: {
          totalSpent: '6000',
          unitsCovered: '300',
          isNone: false,
          items: [
            { id: '34', name: 'Baker Labor', amount: '6000', unitsCovered: '300' },
          ],
        },
        transport: {
          totalSpent: '1000',
          unitsCovered: '300',
          isNone: false,
          items: [
            { id: '35', name: 'Ingredient Transport', amount: '1000', unitsCovered: '300' },
          ],
        },
        overhead: {
          totalSpent: '3500',
          unitsCovered: '300',
          isNone: false,
          items: [
            { id: '36', name: 'Baking Oven Gas & Electricity', amount: '3500', unitsCovered: '300' },
          ],
        },
        machinery: {
          totalSpent: '500',
          unitsCovered: '300',
          isNone: false,
          items: [
            { id: '37', name: 'Mixer & Bakery Equipment Depreciation', amount: '500', unitsCovered: '300' },
          ],
        },
        custom_fees: {
          totalSpent: '',
          unitsCovered: '',
          isNone: true,
          items: [],
        },
      },
    },
    siDraft: {
      productName: 'මාළු පාන්',
      kind: 'product',
      unitLabel: 'එක් බනිසයක්',
      productionBasis: 'batch',
      unitsProduced: '300',
      defectiveUnits: '0',
      defaultUnitsCoveredScope: 'all',
      currencyCode: 'LKR',
      currencyOverridden: true,
      pricingType: 'margin',
      pricingPercentage: '30',
      buckets: {
        material: {
          totalSpent: '18000',
          unitsCovered: '300',
          isNone: false,
          items: [
            { id: '31', name: 'පාන් පිටි සහ මාජරින්', amount: '9000', unitsCovered: '300' },
            { id: '32', name: 'මාළු සහ එළවළු පිරවුම', amount: '7500', unitsCovered: '300' },
            { id: '33', name: 'යීස්ට් සහ කුළුබඩු', amount: '1500', unitsCovered: '300' },
          ],
        },
        labor: {
          totalSpent: '6000',
          unitsCovered: '300',
          isNone: false,
          items: [
            { id: '34', name: 'බේකර් ශ්‍රමය', amount: '6000', unitsCovered: '300' },
          ],
        },
        transport: {
          totalSpent: '1000',
          unitsCovered: '300',
          isNone: false,
          items: [
            { id: '35', name: 'බඩු ප්‍රවාහනය', amount: '1000', unitsCovered: '300' },
          ],
        },
        overhead: {
          totalSpent: '3500',
          unitsCovered: '300',
          isNone: false,
          items: [
            { id: '36', name: 'උඳුන සහ විදුලිය', amount: '3500', unitsCovered: '300' },
          ],
        },
        machinery: {
          totalSpent: '500',
          unitsCovered: '300',
          isNone: false,
          items: [
            { id: '37', name: 'මික්සර් උපකරණ ක්ෂයවීම', amount: '500', unitsCovered: '300' },
          ],
        },
        custom_fees: {
          totalSpent: '',
          unitsCovered: '',
          isNone: true,
          items: [],
        },
      },
    },
    get draft() {
      return this.siDraft;
    },
  },
];
