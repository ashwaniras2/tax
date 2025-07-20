import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Info, IndianRupee, XCircle, CalendarDays, Home } from 'lucide-react'; // Added CalendarDays, Home icons

// Helper component for input fields
const InputField = ({ label, value, onChange, type = 'text', placeholder = '0', icon: Icon = IndianRupee, infoText = '' }) => {
  return (
    <div className="mb-4">
      <label className="block text-gray-700 text-sm font-bold mb-2 flex items-center">
        {Icon && <Icon size={16} className="mr-2 text-indigo-600" />}
        {label}
        {infoText && (
          <span className="ml-2 relative group">
            <Info size={14} className="text-gray-400 cursor-help" />
            <span className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
              {infoText}
            </span>
          </span>
        )}
      </label>
      <input
        type={type}
        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-indigo-500"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        placeholder={placeholder}
      />
    </div>
  );
};

// Helper component for radio buttons
const RadioGroup = ({ label, name, options, selectedValue, onChange }) => (
  <div className="mb-4">
    <label className="block text-gray-700 text-sm font-bold mb-2">{label}</label>
    <div className="flex flex-wrap gap-4">
      {options.map((option) => (
        <div key={option.value} className="flex items-center">
          <input
            type="radio"
            id={`${name}-${option.value}`}
            name={name}
            value={option.value}
            checked={selectedValue === option.value}
            onChange={() => onChange(option.value)}
            className="form-radio h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
          />
          <label htmlFor={`${name}-${option.value}`} className="ml-2 text-gray-700">
            {option.label}
          </label>
        </div>
      ))}
    </div>
  </div>
);


// Main App component for the tax calculator
const App = () => {
  // State variables for user inputs
  const [financialYear, setFinancialYear] = useState('2024-25'); // Default to FY 2024-25
  const [ageGroup, setAgeGroup] = useState('below60');
  const [grossSalary, setGrossSalary] = useState('');
  const [otherIncome, setOtherIncome] = useState('');
  const [housePropertyIncome, setHousePropertyIncome] = useState(''); // Income from HP (before interest deduction for let-out)
  const [homeLoanInterestSelfOccupied, setHomeLoanInterestSelfOccupied] = useState('');
  const [homeLoanInterestLetOut, setHomeLoanInterestLetOut] = useState('');

  // Capital Gains states - now arrays for multiple transactions
  const [stcgTransactions, setStcgTransactions] = useState([{ id: 1, amount: '', date: 'after23July2024' }]);
  const [ltcgTransactions, setLtcgTransactions] = useState([{ id: 1, amount: '', date: 'after23July2024' }]);

  const [deductions80C, setDeductions80C] = useState('');
  const [deductions80D, setDeductions80D] = useState('');
  const [deductions80E, setDeductions80E] = useState('');
  const [deductions80G, setDeductions80G] = useState('');
  const [deductions80TTA, setDeductions80TTA] = useState('');
  const [npsEmployeeContribution, setNpsEmployeeContribution] = useState('');
  const [npsEmployerContribution, setNpsEmployerContribution] = useState('');
  const [hraReceived, setHraReceived] = useState('');
  const [rentPaid, setRentPaid] = useState('');
  const [isMetroCity, setIsMetroCity] = useState(false);
  const [selectedRegime, setSelectedRegime] = useState('new'); // Default to new regime

  // State for residency determination
  const [daysInIndiaCurrentFY, setDaysInIndiaCurrentFY] = useState('');
  const [daysInIndiaPrevious4FY, setDaysInIndiaPrevious4FY] = useState('');
  const [daysInIndiaPrevious7FY, setDaysInIndiaPrevious7FY] = useState('');
  const [wasResident2of10FYs, setWasResident2of10FYs] = useState('no'); // 'yes' or 'no'
  const [residencyStatus, setResidencyStatus] = useState('Not Determined');


  // State for calculated tax results
  const [taxResults, setTaxResults] = useState(null);

  // Ref for debouncing the calculation
  const debounceTimeoutRef = useRef(null);
  const nextStcgId = useRef(2); // For unique IDs for new STCG transactions
  const nextLtcgId = useRef(2); // For unique IDs for new LTCG transactions


  // Functions to add/remove capital gains transactions
  const addStcgTransaction = () => {
    setStcgTransactions([...stcgTransactions, { id: nextStcgId.current++, amount: '', date: 'after23July2024' }]);
  };

  const removeStcgTransaction = (id) => {
    setStcgTransactions(stcgTransactions.filter(tx => tx.id !== id));
  };

  const updateStcgTransaction = (id, field, value) => {
    setStcgTransactions(stcgTransactions.map(tx =>
      tx.id === id ? { ...tx, [field]: value } : tx
    ));
  };

  const addLtcgTransaction = () => {
    setLtcgTransactions([...ltcgTransactions, { id: nextLtcgId.current++, amount: '', date: 'after23July2024' }]);
  };

  const removeLtcgTransaction = (id) => {
    setLtcgTransactions(ltcgTransactions.filter(tx => tx.id !== id));
  };

  const updateLtcgTransaction = (id, field, value) => {
    setLtcgTransactions(ltcgTransactions.map(tx =>
      tx.id === id ? { ...tx, [field]: value } : tx
    ));
  };


  // Constants for tax slabs and deduction limits (for FY 2024-25 and FY 2025-26)
  const TAX_SLABS = {
    '2024-25': {
      old: {
        below60: [
          { limit: 250000, rate: 0 },
          { limit: 500000, rate: 0.05 },
          { limit: 1000000, rate: 0.20 },
          { limit: Infinity, rate: 0.30 }
        ],
        '60to80': [
          { limit: 300000, rate: 0 },
          { limit: 500000, rate: 0.05 },
          { limit: 1000000, rate: 0.20 },
          { limit: Infinity, rate: 0.30 }
        ],
        above80: [
          { limit: 500000, rate: 0 },
          { limit: 1000000, rate: 0.20 },
          { limit: Infinity, rate: 0.30 }
        ]
      },
      new: [
        { limit: 300000, rate: 0 },
        { limit: 700000, rate: 0.05 },
        { limit: 1000000, rate: 0.10 },
        { limit: 1200000, rate: 0.15 },
        { limit: 1500000, rate: 0.20 },
        { limit: Infinity, rate: 0.30 }
      ]
    },
    '2025-26': { // Proposed for FY 2025-26 (AY 2026-27)
      old: { // No change in old regime
        below60: [
          { limit: 250000, rate: 0 },
          { limit: 500000, rate: 0.05 },
          { limit: 1000000, rate: 0.20 },
          { limit: Infinity, rate: 0.30 }
        ],
        '60to80': [
          { limit: 300000, rate: 0 },
          { limit: 500000, rate: 0.05 },
          { limit: 1000000, rate: 0.20 },
          { limit: Infinity, rate: 0.30 }
        ],
        above80: [
          { limit: 500000, rate: 0 },
          { limit: 1000000, rate: 0.20 },
          { limit: Infinity, rate: 0.30 }
        ]
      },
      new: [ // Updated new regime slabs
        { limit: 400000, rate: 0 },
        { limit: 800000, rate: 0.05 },
        { limit: 1200000, rate: 0.10 },
        { limit: 1600000, rate: 0.15 },
        { limit: 2000000, rate: 0.20 },
        { limit: 2400000, rate: 0.25 },
        { limit: Infinity, rate: 0.30 }
      ]
    }
  };

  const DEDUCTION_LIMITS = {
    '2024-25': {
      oldRegimeStandardDeduction: 50000, // Standard deduction for old regime
      newRegimeStandardDeduction: 75000, // Standard deduction for new regime (updated)
      '80C': 150000,
      '80CCD1B': 50000,
      '80D_self_family_below60': 25000,
      '80D_self_family_senior': 50000,
      '80D_parents_below60': 25000,
      '80D_parents_senior': 50000,
      '80TTA': 10000, // For individuals/HUF (interest on savings account)
      '80TTB': 50000, // For senior citizens (interest on savings/FD)
      '24b_self_occupied': 200000, // Home loan interest for self-occupied property
      '87A_rebate_old_regime_limit': 500000,
      '87A_rebate_old_regime_amount': 12500,
      '87A_rebate_new_regime_limit': 700000, // For FY 2024-25 new regime
      '87A_rebate_new_regime_amount': 25000, // For FY 2024-25 new regime
      'house_property_loss_setoff_limit': 200000, // Max loss from HP set-off against other income
    },
    '2025-26': {
      oldRegimeStandardDeduction: 50000, // Standard deduction for old regime
      newRegimeStandardDeduction: 75000, // Standard deduction for new regime (updated)
      '80C': 150000,
      '80CCD1B': 50000,
      '80D_self_family_below60': 25000,
      '80D_self_family_senior': 50000,
      '80D_parents_below60': 25000,
      '80D_parents_senior': 50000,
      '80TTA': 10000,
      '80TTB': 50000,
      '24b_self_occupied': 200000,
      '87A_rebate_old_regime_limit': 500000,
      '87A_rebate_old_regime_amount': 12500,
      '87A_rebate_new_regime_limit': 1200000, // For FY 2025-26 new regime
      '87A_rebate_new_regime_amount': 0, // Rebate is full tax up to limit, not a fixed amount
      'house_property_loss_setoff_limit': 200000, // Max loss from HP set-off against other income
    }
  };

  // Capital Gains Tax Rates based on date of transfer (primarily for listed equity/MFs)
  const CAPITAL_GAINS_RATES = {
    '2024-25': {
      before23July2024: {
        STCG_111A: 0.15, // Listed equity/MFs
        LTCG_112A: { rate: 0.10, exemption: 100000 } // Listed equity/MFs, over 1 lakh
      },
      after23July2024: {
        STCG_111A: 0.20, // Listed equity/MFs
        LTCG_112A: { rate: 0.125, exemption: 125000 } // Listed equity/MFs, over 1.25 lakh
      }
    },
    '2025-26': { // Assuming rates remain same as post-July 23, 2024 for FY25-26 unless further changes are announced
      before23July2024: { // This option is less relevant for FY25-26 as the date has passed, but for completeness
        STCG_111A: 0.15,
        LTCG_112A: { rate: 0.10, exemption: 100000 }
      },
      after23July2024: {
        STCG_111A: 0.20,
        LTCG_112A: { rate: 0.125, exemption: 125000 }
      }
    }
  };

  // Function to calculate HRA exemption - Wrapped in useCallback
  const calculateHRAExemption = useCallback((basicSalary, da, hraReceivedAmt, rentPaidAmt, isMetro) => {
    // If HRA is not received or rent is not paid, no exemption
    if (hraReceivedAmt === 0 || rentPaidAmt === 0) return 0;

    const actualHRA = hraReceivedAmt;
    const rentPaidMinus10PercentSalary = Math.max(0, rentPaidAmt - (0.10 * (basicSalary + da)));
    const percentageOfSalary = (isMetro ? 0.50 : 0.40) * (basicSalary + da);

    // The least of the three is the exemption
    return Math.min(actualHRA, rentPaidMinus10PercentSalary, percentageOfSalary);
  }, []); // No external dependencies for this helper

  // Function to calculate tax for a given taxable income and slabs - Wrapped in useCallback
  const calculateTaxFromSlabs = useCallback((taxableIncome, slabs) => {
    let tax = 0;
    let incomeRemaining = taxableIncome;
    const breakdown = [];

    for (let i = 0; i < slabs.length; i++) {
      const slab = slabs[i];
      const prevSlabLimit = i === 0 ? 0 : slabs[i - 1].limit;
      const currentSlabUpperLimit = slab.limit;
      const currentSlabLowerLimit = prevSlabLimit;

      if (incomeRemaining <= 0) break; // No more income to tax

      // Amount of income that falls into the current slab
      let incomeInCurrentSlab = 0;
      if (currentSlabUpperLimit === Infinity) {
        incomeInCurrentSlab = incomeRemaining;
      } else {
        incomeInCurrentSlab = Math.min(incomeRemaining, currentSlabUpperLimit - currentSlabLowerLimit);
      }

      const taxInSlab = incomeInCurrentSlab * slab.rate;
      tax += taxInSlab;

      if (incomeInCurrentSlab > 0) {
        breakdown.push(`₹${(currentSlabLowerLimit).toLocaleString('en-IN')} - ₹${(currentSlabUpperLimit === Infinity ? 'Above' : currentSlabUpperLimit).toLocaleString('en-IN')}: ${Math.round(slab.rate * 100)}% on ₹${incomeInCurrentSlab.toLocaleString('en-IN')} = ₹${taxInSlab.toLocaleString('en-IN')}`);
      }
      incomeRemaining -= incomeInCurrentSlab;
    }
    return { tax, breakdown };
  }, []); // No external dependencies for this helper


  // Main tax calculation function - Wrapped in useCallback
  const calculateTax = useCallback(() => {
    console.log("--- Starting Tax Calculation ---");
    console.log("Current financialYear:", financialYear);
    console.log("Current ageGroup:", ageGroup);
    console.log("Current grossSalary:", grossSalary);
    console.log("Current otherIncome:", otherIncome);
    console.log("Current housePropertyIncome:", housePropertyIncome);
    console.log("Current homeLoanInterestSelfOccupied:", homeLoanInterestSelfOccupied);
    console.log("Current homeLoanInterestLetOut:", homeLoanInterestLetOut);
    console.log("Current stcgTransactions:", stcgTransactions); // Log new state
    console.log("Current ltcgTransactions:", ltcgTransactions); // Log new state
    console.log("Current deductions80C:", deductions80C);
    console.log("Current deductions80D:", deductions80D);
    console.log("Current deductions80E:", deductions80E);
    console.log("Current deductions80G:", deductions80G);
    console.log("Current deductions80TTA:", deductions80TTA);
    console.log("Current npsEmployeeContribution:", npsEmployeeContribution);
    console.log("Current npsEmployerContribution:", npsEmployerContribution);
    console.log("Current hraReceived:", hraReceived);
    console.log("Current rentPaid:", rentPaid);
    console.log("Current isMetroCity:", isMetroCity);
    console.log("Current selectedRegime:", selectedRegime);
    console.log("Current residencyStatus:", residencyStatus); // Log residency status

    try {
      const fyLimits = DEDUCTION_LIMITS[financialYear];

      const parsedGrossSalary = parseFloat(grossSalary) || 0;
      const parsedOtherIncome = parseFloat(otherIncome) || 0;
      const parsedHousePropertyIncome = parseFloat(housePropertyIncome) || 0;
      const parsedHomeLoanInterestSelfOccupied = parseFloat(homeLoanInterestSelfOccupied) || 0;
      const parsedHomeLoanInterestLetOut = parseFloat(homeLoanInterestLetOut) || 0;
      const parsedDeductions80C = parseFloat(deductions80C) || 0;
      const parsedDeductions80D = parseFloat(deductions80D) || 0;
      const parsedDeductions80E = parseFloat(deductions80E) || 0;
      const parsedDeductions80G = parseFloat(deductions80G) || 0;
      const parsedDeductions80TTA = parseFloat(deductions80TTA) || 0;
      const parsedNpsEmployeeContribution = parseFloat(npsEmployeeContribution) || 0;
      const parsedNpsEmployerContribution = parseFloat(npsEmployerContribution) || 0;
      const parsedHraReceived = parseFloat(hraReceived) || 0;
      const parsedRentPaid = parseFloat(rentPaid) || 0;

      // --- Calculate Income from each Head (before deductions) ---
      const incomeFromSalary = parsedGrossSalary;
      const incomeFromOtherSources = parsedOtherIncome;

      // Calculate Net Income/Loss from House Property after Let-out Interest
      let netHousePropertyIncomeAfterLetOutInterest = parsedHousePropertyIncome - parsedHomeLoanInterestLetOut;

      // --- Capital Gains Calculation ---
      let totalCapitalGainsAmount = 0; // Sum of all STCG and LTCG for GTI
      let capitalGainsTax = 0;
      let capitalGainsBreakdown = [];

      // Process STCG transactions
      stcgTransactions.forEach(tx => {
        const parsedAmount = parseFloat(tx.amount) || 0;
        if (parsedAmount > 0) {
          totalCapitalGainsAmount += parsedAmount;
          const stcgRates = CAPITAL_GAINS_RATES[financialYear][tx.date];
          const stcgTax = parsedAmount * stcgRates.STCG_111A;
          capitalGainsTax += stcgTax;
          capitalGainsBreakdown.push(`Short Term Capital Gain (₹${parsedAmount.toLocaleString('en-IN')}) realized ${tx.date === 'before23July2024' ? 'before' : 'on or after'} 23rd July 2024, taxed at ${Math.round(stcgRates.STCG_111A * 100)}%: ₹${stcgTax.toLocaleString('en-IN')}`);
        }
      });

      // Process LTCG transactions
      ltcgTransactions.forEach(tx => {
        const parsedAmount = parseFloat(tx.amount) || 0;
        if (parsedAmount > 0) {
          totalCapitalGainsAmount += parsedAmount;
          const ltcgRates = CAPITAL_GAINS_RATES[financialYear][tx.date];
          let taxableLTCG = Math.max(0, parsedAmount - ltcgRates.LTCG_112A.exemption);
          const ltcgTax = taxableLTCG * ltcgRates.LTCG_112A.rate;
          capitalGainsTax += ltcgTax;
          capitalGainsBreakdown.push(`Long Term Capital Gain (₹${parsedAmount.toLocaleString('en-IN')}) realized ${tx.date === 'before23July2024' ? 'before' : 'on or after'} 23rd July 2024, taxed at ${Math.round(ltcgRates.LTCG_112A.rate * 100)}% (after ₹${ltcgRates.LTCG_112A.exemption.toLocaleString('en-IN')} exemption): ₹${ltcgTax.toLocaleString('en-IN')}`);
        }
      });
      console.log("Total Capital Gains Tax:", capitalGainsTax);

      // Calculate Gross Total Income (GTI) for surcharge calculation (sum of all heads before Chapter VI-A deductions)
      const totalGrossIncomeForSurcharge = incomeFromSalary + incomeFromOtherSources + parsedHousePropertyIncome + totalCapitalGainsAmount;


      // --- Old Regime Calculation ---
      // Start with general income (excluding capital gains for slab taxation)
      let oldRegimeTaxableIncome = incomeFromSalary + incomeFromOtherSources + netHousePropertyIncomeAfterLetOutInterest;
      let oldRegimeDeductionsBreakdown = [];

      // Conditional deductions based on residency status for Old Regime
      let currentStandardDeduction = 0;
      let currentHRAExemption = 0;
      let current80CDeduction = 0;
      let current80DDeduction = 0;
      let current80EDeduction = 0;
      let current80GDeduction = 0;
      let current80TTADeduction = 0;
      let currentNpsEmployerDeduction = 0;
      let current87ARebateOldRegime = 0;

      if (residencyStatus !== 'Non-Resident (NRI)') {
        // Standard Deduction (Salaried) - Old Regime
        currentStandardDeduction = Math.min(parsedGrossSalary, fyLimits.oldRegimeStandardDeduction);
        if (currentStandardDeduction > 0) oldRegimeDeductionsBreakdown.push(`Standard Deduction: ₹${currentStandardDeduction.toLocaleString('en-IN')}`);

        // HRA Exemption
        currentHRAExemption = calculateHRAExemption(parsedGrossSalary, 0, parsedHraReceived, parsedRentPaid, isMetroCity); // Assuming DA is 0 for simplicity
        if (currentHRAExemption > 0) oldRegimeDeductionsBreakdown.push(`HRA Exemption: ₹${currentHRAExemption.toLocaleString('en-IN')}`);

        // Deductions under Chapter VI-A (80C, 80D, 80E, 80G, 80TTA/TTB, 80CCD)
        let total80CDeductions = Math.min(parsedDeductions80C, fyLimits['80C']);
        let total80CCD1BDeduction = Math.min(parsedNpsEmployeeContribution, fyLimits['80CCD1B']); // Additional NPS
        current80CDeduction = Math.min(total80CDeductions + total80CCD1BDeduction, fyLimits['80C'] + fyLimits['80CCD1B']); // 80C + 80CCD(1B) combined limit
        if (current80CDeduction > 0) oldRegimeDeductionsBreakdown.push(`Deductions u/s 80C/80CCD(1B): ₹${current80CDeduction.toLocaleString('en-IN')}`);

        current80DDeduction = Math.min(parsedDeductions80D, fyLimits['80D_self_family_below60'] + fyLimits['80D_parents_below60']); // Simplified, actual depends on age of self/family/parents
        if (current80DDeduction > 0) oldRegimeDeductionsBreakdown.push(`Deductions u/s 80D: ₹${current80DDeduction.toLocaleString('en-IN')}`);

        current80EDeduction = parsedDeductions80E; // No limit specified for 80E
        if (current80EDeduction > 0) oldRegimeDeductionsBreakdown.push(`Deductions u/s 80E: ₹${current80EDeduction.toLocaleString('en-IN')}`);

        current80GDeduction = parsedDeductions80G; // 80G has complex rules (50%/100%, with/without limit) - simplified here
        if (current80GDeduction > 0) oldRegimeDeductionsBreakdown.push(`Deductions u/s 80G: ₹${current80GDeduction.toLocaleString('en-IN')}`);

        if (ageGroup === '60to80' || ageGroup === 'above80') {
          current80TTADeduction = Math.min(parsedDeductions80TTA, fyLimits['80TTB']);
        } else {
          current80TTADeduction = Math.min(parsedDeductions80TTA, fyLimits['80TTA']);
        }
        if (current80TTADeduction > 0) oldRegimeDeductionsBreakdown.push(`Deductions u/s 80TTA/TTB: ₹${current80TTADeduction.toLocaleString('en-IN')}`);

        // Rebate under Section 87A for Old Regime
        if (oldRegimeTaxableIncome <= fyLimits['87A_rebate_old_regime_limit']) {
          current87ARebateOldRegime = Math.min(oldRegimeTaxOnGeneralIncome, fyLimits['87A_rebate_old_regime_amount']); // Rebate applies only to general income tax
        }
      } else {
        oldRegimeDeductionsBreakdown.push("Note: Most deductions and 87A rebate are not applicable for Non-Residents (NRI).");
      }

      // Home Loan Interest (Self-occupied) is generally allowed for NRIs also, but capped.
      const homeLoanInterestDeductionSelfOccupied = Math.min(parsedHomeLoanInterestSelfOccupied, fyLimits['24b_self_occupied']);
      if (homeLoanInterestDeductionSelfOccupied > 0) oldRegimeDeductionsBreakdown.unshift(`Home Loan Interest (Self-occupied): ₹${homeLoanInterestDeductionSelfOccupied.toLocaleString('en-IN')}`);


      // NPS Employer Contribution (80CCD(2)) - Over and above 80C/80CCE limit - generally allowed for NRIs for Indian employers
      currentNpsEmployerDeduction = Math.min(parsedNpsEmployerContribution, 0.10 * parsedGrossSalary); // Max 10% of salary
      if (currentNpsEmployerDeduction > 0) oldRegimeDeductionsBreakdown.push(`Employer NPS Contribution u/s 80CCD(2): ₹${currentNpsEmployerDeduction.toLocaleString('en-IN')}`);


      // Calculate taxable income after applying conditional deductions
      oldRegimeTaxableIncome = Math.max(0, oldRegimeTaxableIncome
        - currentStandardDeduction
        - currentHRAExemption
        - current80CDeduction
        - current80DDeduction
        - current80EDeduction
        - current80GDeduction
        - current80TTADeduction
        - currentNpsEmployerDeduction
        - homeLoanInterestDeductionSelfOccupied
      );

      // Apply old regime tax slabs based on age group
      const oldRegimeSlabs = TAX_SLABS[financialYear].old[ageGroup];
      let { tax: oldRegimeTaxOnGeneralIncome, breakdown: oldRegimeTaxBreakdown } = calculateTaxFromSlabs(oldRegimeTaxableIncome, oldRegimeSlabs);
      let oldRegimeTax = oldRegimeTaxOnGeneralIncome + capitalGainsTax; // Add capital gains tax to general income tax

      // Apply 87A rebate for old regime
      oldRegimeTax = Math.max(0, oldRegimeTax - current87ARebateOldRegime);
      if (current87ARebateOldRegime > 0) oldRegimeTaxBreakdown.push(`Less: Rebate u/s 87A: -₹${current87ARebateOldRegime.toLocaleString('en-IN')}`);


      // Add capital gains breakdown to the overall tax breakdown for Old Regime
      if (capitalGainsBreakdown.length > 0) {
          oldRegimeTaxBreakdown.unshift("--- Capital Gains Tax ---");
          oldRegimeTaxBreakdown.push(...capitalGainsBreakdown);
      }

      // Surcharge for Old Regime
      let oldRegimeSurcharge = 0;
      if (totalGrossIncomeForSurcharge > 5000000 && totalGrossIncomeForSurcharge <= 10000000) {
        oldRegimeSurcharge = oldRegimeTax * 0.10;
      } else if (totalGrossIncomeForSurcharge > 10000000 && totalGrossIncomeForSurcharge <= 20000000) {
        oldRegimeSurcharge = oldRegimeTax * 0.15;
      } else if (totalGrossIncomeForSurcharge > 20000000 && totalGrossIncomeForSurcharge <= 50000000) {
        oldRegimeSurcharge = oldRegimeTax * 0.25;
      } else if (totalGrossIncomeForSurcharge > 50000000) {
        oldRegimeSurcharge = oldRegimeTax * 0.37;
      }
      if (oldRegimeSurcharge > 0) oldRegimeTaxBreakdown.push(`Surcharge: ₹${oldRegimeSurcharge.toLocaleString('en-IN')}`);

      // Health and Education Cess for Old Regime
      const oldRegimeCess = (oldRegimeTax + oldRegimeSurcharge) * 0.04;
      oldRegimeTaxBreakdown.push(`Health & Education Cess (4%): ₹${oldRegimeCess.toLocaleString('en-IN')}`);

      const finalOldRegimeTax = oldRegimeTax + oldRegimeSurcharge + oldRegimeCess;


      // --- New Regime Calculation ---
      // Start with general income (excluding capital gains for slab taxation)
      let newRegimeTaxableIncome = incomeFromSalary + incomeFromOtherSources + netHousePropertyIncomeAfterLetOutInterest;
      let newRegimeDeductionsBreakdown = [];

      // Conditional deductions based on residency status for New Regime
      let newRegimeCurrentStandardDeduction = 0;
      let newRegimeCurrentNpsEmployerDeduction = 0;
      let newRegimeCurrent87ARebate = 0;

      if (residencyStatus !== 'Non-Resident (NRI)') {
        // Standard Deduction (Salaried) - New Regime
        newRegimeCurrentStandardDeduction = Math.min(parsedGrossSalary, fyLimits.newRegimeStandardDeduction);
        if (newRegimeCurrentStandardDeduction > 0) newRegimeDeductionsBreakdown.push(`Standard Deduction: ₹${newRegimeCurrentStandardDeduction.toLocaleString('en-IN')}`);

        // Rebate under Section 87A for New Regime (including Marginal Relief for FY 2025-26)
        if (financialYear === '2024-25') {
          if (newRegimeTaxableIncome <= fyLimits['87A_rebate_new_regime_limit']) {
            newRegimeCurrent87ARebate = Math.min(newRegimeTaxOnGeneralIncome, fyLimits['87A_rebate_new_regime_amount']); // Rebate applies only to general income tax
          }
        } else if (financialYear === '2025-26') {
          const rebateLimitFY2526 = fyLimits['87A_rebate_new_regime_limit']; // 12,00,000

          if (newRegimeTaxableIncome <= rebateLimitFY2526) {
              newRegimeCurrent87ARebate = newRegimeTaxOnGeneralIncome; // Full tax rebate up to 12L on general income
          } else {
              const taxWithoutRebate = newRegimeTaxOnGeneralIncome;
              const incomeExceedingRebateLimit = newRegimeTaxableIncome - rebateLimitFY2526;
              if (taxWithoutRebate > incomeExceedingRebateLimit) {
                  newRegimeCurrent87ARebate = taxWithoutRebate - incomeExceedingRebateLimit;
              } else {
                  newRegimeCurrent87ARebate = 0;
              }
          }
        }
      } else {
        newRegimeDeductionsBreakdown.push("Note: Standard deduction and 87A rebate are not applicable for Non-Residents (NRI) in New Regime.");
      }

      // Employer's contribution to NPS (80CCD(2)) - Allowed in new regime for all residents
      newRegimeCurrentNpsEmployerDeduction = Math.min(parsedNpsEmployerContribution, 0.10 * parsedGrossSalary); // Max 10% of salary
      if (newRegimeCurrentNpsEmployerDeduction > 0) newRegimeDeductionsBreakdown.push(`Employer NPS Contribution u/s 80CCD(2): ₹${newRegimeCurrentNpsEmployerDeduction.toLocaleString('en-IN')}`);


      // Calculate taxable income after applying conditional deductions for new regime
      newRegimeTaxableIncome = Math.max(0, newRegimeTaxableIncome
        - newRegimeCurrentStandardDeduction
        - newRegimeCurrentNpsEmployerDeduction
      );


      console.log("New Regime Taxable Income (before slab calc):", newRegimeTaxableIncome);
      // Apply new regime tax slabs
      const newRegimeSlabs = TAX_SLABS[financialYear].new;
      console.log("New Regime Slabs being used:", newRegimeSlabs);
      let { tax: newRegimeTaxOnGeneralIncome, breakdown: newRegimeTaxBreakdown } = calculateTaxFromSlabs(newRegimeTaxableIncome, newRegimeSlabs);
      let newRegimeTax = newRegimeTaxOnGeneralIncome + capitalGainsTax; // Add capital gains tax to general income tax
      console.log("New Regime Tax (before rebate/marginal relief):", newRegimeTax);

      // Apply 87A rebate for new regime
      newRegimeTax = Math.max(0, newRegimeTax - newRegimeCurrent87ARebate);
      if (newRegimeCurrent87ARebate > 0) newRegimeTaxBreakdown.push(`Less: Rebate u/s 87A (including Marginal Relief): -₹${newRegimeCurrent87ARebate.toLocaleString('en-IN')}`);


      // Add capital gains breakdown to the overall tax breakdown for New Regime
      if (capitalGainsBreakdown.length > 0) {
          newRegimeTaxBreakdown.unshift("--- Capital Gains Tax ---");
          newRegimeTaxBreakdown.push(...capitalGainsBreakdown);
      }

      // Surcharge for New Regime (capped at 25%)
      let newRegimeSurcharge = 0;
      if (totalGrossIncomeForSurcharge > 5000000 && totalGrossIncomeForSurcharge <= 10000000) {
        newRegimeSurcharge = newRegimeTax * 0.10;
      } else if (totalGrossIncomeForSurcharge > 10000000 && totalGrossIncomeForSurcharge <= 20000000) {
        newRegimeSurcharge = newRegimeTax * 0.15;
      } else if (totalGrossIncomeForSurcharge > 20000000) {
        newRegimeSurcharge = newRegimeTax * 0.25; // Capped at 25%
      }
      if (newRegimeSurcharge > 0) newRegimeTaxBreakdown.push(`Surcharge: ₹${newRegimeSurcharge.toLocaleString('en-IN')}`);
      console.log("New Regime Surcharge:", newRegimeSurcharge);


      // Health and Education Cess for New Regime
      const newRegimeCess = (newRegimeTax + newRegimeSurcharge) * 0.04;
      newRegimeTaxBreakdown.push(`Health & Education Cess (4%): ₹${newRegimeCess.toLocaleString('en-IN')}`);
      console.log("New Regime Cess:", newRegimeCess);


      const finalNewRegimeTax = newRegimeTax + newRegimeSurcharge + newRegimeCess;
      console.log("Final New Regime Tax:", finalNewRegimeTax);
      console.log("--- End Tax Calculation ---");


      setTaxResults({
        initialGrossTotalIncome: totalGrossIncomeForSurcharge, // Store GTI in state
        oldRegime: {
          taxableIncome: oldRegimeTaxableIncome,
          totalTax: finalOldRegimeTax,
          deductionsBreakdown: oldRegimeDeductionsBreakdown,
          taxBreakdown: oldRegimeTaxBreakdown
        },
        newRegime: {
          taxableIncome: newRegimeTaxableIncome,
          totalTax: finalNewRegimeTax,
          deductionsBreakdown: newRegimeDeductionsBreakdown,
          taxBreakdown: newRegimeTaxBreakdown
        }
      });
      console.log("Tax results state updated.");

    } catch (error) {
      console.error("Error calculating tax:", error);
      setTaxResults(null); // Clear results on error
      // In a real application, replace alert with a custom modal or error message display
      // alert("An error occurred during calculation. Please check your inputs.");
    }
  }, [
    financialYear, ageGroup, grossSalary, otherIncome, housePropertyIncome,
    homeLoanInterestSelfOccupied, homeLoanInterestLetOut, stcgTransactions, ltcgTransactions, // Dependencies are now the transaction arrays
    deductions80C, deductions80D, deductions80E,
    deductions80G, deductions80TTA, npsEmployeeContribution, npsEmployerContribution,
    hraReceived, rentPaid, isMetroCity, TAX_SLABS, DEDUCTION_LIMITS, CAPITAL_GAINS_RATES, calculateHRAExemption, calculateTaxFromSlabs, residencyStatus // Added residencyStatus to dependencies
  ]);

  // Function to calculate residency status
  const determineResidencyStatus = useCallback(() => {
    const currentFYDays = parseFloat(daysInIndiaCurrentFY) || 0;
    const prev4FYDays = parseFloat(daysInIndiaPrevious4FY) || 0;
    const prev7FYDays = parseFloat(daysInIndiaPrevious7FY) || 0;
    const isResident2of10 = wasResident2of10FYs === 'yes';

    let isResident = false;
    let isROR = false;

    // Basic Condition 1: Stay of 182 days or more in current FY
    const basicCondition1 = currentFYDays >= 182;

    // Basic Condition 2: Stay of 60 days or more in current FY AND 365 days or more in 4 preceding FYs
    const basicCondition2 = currentFYDays >= 60 && prev4FYDays >= 365;

    if (basicCondition1 || basicCondition2) {
      isResident = true;

      // If Resident, check Additional Conditions for ROR
      // Additional Condition A: Resident in India for at least 2 out of 10 preceding FYs
      // (Simplified to a direct input for this calculator)
      const additionalConditionA = isResident2of10;

      // Additional Condition B: Stay of 730 days or more in 7 preceding FYs
      const additionalConditionB = prev7FYDays >= 730;

      // A person is ROR if they meet both additional conditions OR if they are a resident and do not meet either of the additional conditions for RNOR.
      // For simplicity in this calculator, we'll define ROR as meeting both additional conditions,
      // and RNOR as meeting basic conditions but not both additional conditions.
      // An individual is RNOR if they are a resident but satisfy neither of the additional conditions, OR
      // if they have been an NRI for 9 out of 10 preceding years, OR
      // if their stay in India during the 7 preceding years is less than 730 days.

      // Revised logic for RNOR/ROR:
      // An individual is ROR if they satisfy both additional conditions.
      // An individual is RNOR if they satisfy basic conditions but do not satisfy both additional conditions.

      if (additionalConditionA && additionalConditionB) {
        isROR = true;
      }

    }

    if (isResident) {
      if (isROR) {
        setResidencyStatus('Resident & Ordinarily Resident (ROR)');
      } else {
        setResidencyStatus('Resident but Not Ordinarily Resident (RNOR)');
      }
    } else {
      setResidencyStatus('Non-Resident (NRI)');
    }
  }, [daysInIndiaCurrentFY, daysInIndiaPrevious4FY, daysInIndiaPrevious7FY, wasResident2of10FYs]);

  // Effect to determine residency status whenever relevant inputs change
  useEffect(() => {
    determineResidencyStatus();
  }, [daysInIndiaCurrentFY, daysInIndiaPrevious4FY, daysInIndiaPrevious7FY, wasResident2of10FYs, determineResidencyStatus]);


  // Function to reset all state variables to their initial values
  const resetForm = useCallback(() => {
    setFinancialYear('2024-25'); // Reset to 2024-25
    setAgeGroup('below60');
    setGrossSalary('');
    setOtherIncome('');
    setHousePropertyIncome('');
    setHomeLoanInterestSelfOccupied('');
    setHomeLoanInterestLetOut('');
    setStcgTransactions([{ id: 1, amount: '', date: 'after23July2024' }]); // Reset STCG transactions
    setLtcgTransactions([{ id: 1, amount: '', date: 'after23July2024' }]); // Reset LTCG transactions
    nextStcgId.current = 2; // Reset ID counter
    nextLtcgId.current = 2; // Reset ID counter
    setDeductions80C('');
    setDeductions80D('');
    setDeductions80E('');
    setDeductions80G('');
    setDeductions80TTA('');
    setNpsEmployeeContribution('');
    setNpsEmployerContribution('');
    setHraReceived('');
    setRentPaid('');
    setIsMetroCity(false);
    setSelectedRegime('new');
    setTaxResults(null); // Clear results display

    // Reset residency status fields
    setDaysInIndiaCurrentFY('');
    setDaysInIndiaPrevious4FY('');
    setDaysInIndiaPrevious7FY('');
    setWasResident2of10FYs('no');
    setResidencyStatus('Not Determined');

    console.log("Form reset.");
  }, []); // No external dependencies

  // Effect to recalculate tax whenever inputs change (debounced)
  useEffect(() => {
    // Clear any existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set a new debounce timeout
    debounceTimeoutRef.current = setTimeout(() => {
      // Only calculate if primary income fields or capital gains have values
      const hasIncome = grossSalary !== '' || otherIncome !== '' || housePropertyIncome !== '';
      const hasCapitalGains = stcgTransactions.some(tx => parseFloat(tx.amount) > 0) || ltcgTransactions.some(tx => parseFloat(tx.amount) > 0);

      if (hasIncome || hasCapitalGains) {
        calculateTax();
      } else {
        setTaxResults(null); // Clear results if all primary income fields and capital gains are empty
      }
    }, 500); // 500ms debounce time

    // Cleanup function: clear timeout if component unmounts or dependencies change
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [
    financialYear, ageGroup, grossSalary, otherIncome, housePropertyIncome,
    homeLoanInterestSelfOccupied, homeLoanInterestLetOut, stcgTransactions, ltcgTransactions, // Dependencies are now the transaction arrays
    deductions80C, deductions80D, deductions80E,
    deductions80G, deductions80TTA, npsEmployeeContribution, npsEmployerContribution,
    hraReceived, rentPaid, isMetroCity, selectedRegime, calculateTax, residencyStatus // Added residencyStatus to dependencies
  ]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-4 sm:p-6 font-inter">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="p-6 sm:p-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-indigo-800 mb-6">
            Indian Income Tax Calculator (India)
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Estimate your tax liability under the Old and New Tax Regimes.
          </p>

          {/* Residency Status Determination Section */}
          <div className="bg-green-50 p-6 rounded-lg shadow-inner mb-8 border border-green-200">
            <h2 className="text-xl font-semibold text-green-700 mb-4 flex items-center">
              <Home size={20} className="mr-2 text-green-600" />
              Residency Status Determination (Section 6)
            </h2>
            <InputField
              label="Days stayed in India during Current Financial Year (FY)"
              value={daysInIndiaCurrentFY}
              onChange={setDaysInIndiaCurrentFY}
              type="number"
              infoText="Basic Condition 1: 182 days or more. Basic Condition 2: 60 days or more (if also 365+ days in 4 preceding FYs)."
              icon={CalendarDays}
            />
            <InputField
              label="Days stayed in India during 4 preceding FYs (total)"
              value={daysInIndiaPrevious4FY}
              onChange={setDaysInIndiaPrevious4FY}
              type="number"
              infoText="Used for Basic Condition 2: 365 days or more (if current FY stay is 60+ days)."
              icon={CalendarDays}
            />
            <InputField
              label="Days stayed in India during 7 preceding FYs (total)"
              value={daysInIndiaPrevious7FY}
              onChange={setDaysInIndiaPrevious7FY}
              type="number"
              infoText="Used for Additional Condition B for ROR: 730 days or more."
              icon={CalendarDays}
            />
            <RadioGroup
              label="Was Resident in India for at least 2 out of 10 preceding FYs?"
              name="wasResident2of10FYs"
              options={[
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' }
              ]}
              selectedValue={wasResident2of10FYs}
              onChange={setWasResident2of10FYs}
            />
            <div className="mt-4 p-3 bg-green-100 rounded-md border border-green-300">
              <p className="text-lg font-bold text-green-800">
                Your Residency Status: <span className="text-green-900">{residencyStatus}</span>
              </p>
              <p className="text-sm text-green-700 mt-2">
                <span className="font-semibold">Note:</span> This determination is for common scenarios. Complex cases (e.g., specific employment types, deemed residency) may require professional advice.
              </p>
            </div>
          </div>

          {/* Financial Year and Age Group Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <RadioGroup
              label="Select Financial Year (FY)"
              name="financialYear"
              options={[
                { label: 'FY 2024-25 (AY 2025-26)', value: '2024-25' },
                { label: 'FY 2025-26 (AY 2026-27)', value: '2025-26' }
              ]}
              selectedValue={financialYear}
              onChange={setFinancialYear}
            />
            <RadioGroup
              label="Select Age Group"
              name="ageGroup"
              options={[
                { label: 'Below 60 years', value: 'below60' },
                { label: '60 to 80 years (Senior Citizen)', value: '60to80' },
                { label: 'Above 80 years (Super Senior Citizen)', value: 'above80' }
              ]}
              selectedValue={ageGroup}
              onChange={setAgeGroup}
            />
          </div>

          {/* Income Details Section */}
          <div className="bg-indigo-50 p-6 rounded-lg shadow-inner mb-8">
            <h2 className="text-xl font-semibold text-indigo-700 mb-4">Income Details</h2>
            <InputField
              label="Gross Salary (before deductions)"
              value={grossSalary}
              onChange={setGrossSalary}
              infoText="Total salary received including allowances, before any deductions like PF, professional tax etc."
            />
            <InputField
              label="Other Income (e.g., interest, dividends)"
              value={otherIncome}
              onChange={setOtherIncome}
              infoText="Income from sources other than salary, house property, or capital gains."
            />
            <InputField
              label="Income from House Property (after municipal tax & 30% std. deduction for let-out)"
              value={housePropertyIncome}
              onChange={setHousePropertyIncome}
              infoText="Enter net income from house property (can be negative if gross rent is low). This is before home loan interest for let-out property. For self-occupied, enter 0."
            />
            
            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Capital Gains Details (Primarily for Listed Equity/MFs)</h3>
            
            {/* STCG Transactions */}
            <h4 className="font-semibold text-gray-700 mb-2">Short Term Capital Gains Transactions:</h4>
            {stcgTransactions.map((tx, index) => (
              <div key={tx.id} className="border border-gray-200 p-4 rounded-lg mb-4 relative">
                <button
                  onClick={() => removeStcgTransaction(tx.id)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                  aria-label="Remove STCG transaction"
                >
                  <XCircle size={20} />
                </button>
                <InputField
                  label={`STCG Amount #${index + 1}`}
                  value={tx.amount}
                  onChange={(val) => updateStcgTransaction(tx.id, 'amount', val)}
                  infoText="Gains from sale of assets held for a short period (e.g., equity shares held for less than 12 months). Taxed at special rates (15% or 20%)."
                />
                <RadioGroup
                  label="Realized Date"
                  name={`stcgDate-${tx.id}`}
                  options={[
                    { label: 'Before 23rd July 2024', value: 'before23July2024' },
                    { label: 'On or After 23rd July 2024', value: 'after23July2024' }
                  ]}
                  selectedValue={tx.date}
                  onChange={(val) => updateStcgTransaction(tx.id, 'date', val)}
                />
              </div>
            ))}
            <button
              onClick={addStcgTransaction}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg mb-6 transition duration-300 ease-in-out"
            >
              + Add More STCG
            </button>

            {/* LTCG Transactions */}
            <h4 className="font-semibold text-gray-700 mb-2 mt-6">Long Term Capital Gains Transactions:</h4>
            {ltcgTransactions.map((tx, index) => (
              <div key={tx.id} className="border border-gray-200 p-4 rounded-lg mb-4 relative">
                <button
                  onClick={() => removeLtcgTransaction(tx.id)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                  aria-label="Remove LTCG transaction"
                >
                  <XCircle size={20} />
                </button>
                <InputField
                  label={`LTCG Amount #${index + 1}`}
                  value={tx.amount}
                  onChange={(val) => updateLtcgTransaction(tx.id, 'amount', val)}
                  infoText="Gains from sale of assets held for a long period (e.g., equity shares held for more than 12 months). Taxed at special rates (10% or 12.5%) after exemption."
                />
                <RadioGroup
                  label="Realized Date"
                  name={`ltcgDate-${tx.id}`}
                  options={[
                    { label: 'Before 23rd July 2024', value: 'before23July2024' },
                    { label: 'On or After 23rd July 2024', value: 'after23July2024' }
                  ]}
                  selectedValue={tx.date}
                  onChange={(val) => updateLtcgTransaction(tx.id, 'date', val)}
                />
              </div>
            ))}
            <button
              onClick={addLtcgTransaction}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg mb-6 transition duration-300 ease-in-out"
            >
              + Add More LTCG
            </button>
          </div>

          {/* Deductions Section */}
          <div className="bg-purple-50 p-6 rounded-lg shadow-inner mb-8">
            <h2 className="text-xl font-semibold text-purple-700 mb-4">Deductions (Old Regime Applicable)</h2>
            <InputField
              label="Home Loan Interest (Self-occupied Property)"
              value={homeLoanInterestSelfOccupied}
              onChange={setHomeLoanInterestSelfOccupied}
              infoText={`Max deduction: ₹${DEDUCTION_LIMITS[financialYear]['24b_self_occupied'].toLocaleString('en-IN')}`}
            />
            <InputField
              label="Home Loan Interest (Let-out Property)"
              value={homeLoanInterestLetOut}
              onChange={setHomeLoanInterestLetOut}
              infoText="Interest paid on home loan for a property that is rented out. This reduces income from house property, and any resulting loss is capped at ₹2,00,000 for set-off."
            />
            <InputField
              label="Deductions u/s 80C (PPF, ELSS, Life Insurance, EPF, Home Loan Principal, Tuition Fees)"
              value={deductions80C}
              onChange={setDeductions80C}
              infoText={`Max deduction: ₹${DEDUCTION_LIMITS[financialYear]['80C'].toLocaleString('en-IN')}`}
            />
            <InputField
              label="Deductions u/s 80D (Health Insurance Premium)"
              value={deductions80D}
              onChange={setDeductions80D}
              infoText="For self, family, and parents. Limits vary by age (e.g., ₹25,000 for below 60, ₹50,000 for senior citizens)."
            />
            <InputField
              label="Deductions u/s 80E (Interest on Education Loan)"
              value={deductions80E}
              onChange={setDeductions80E}
              infoText="No upper limit on deduction for interest paid on education loan."
            />
            <InputField
              label="Deductions u/s 80G (Donations to Charitable Institutions)"
              value={deductions80G}
              onChange={setDeductions80G}
              infoText="Deduction depends on the type of institution (50% or 100% of donation, some with limits)."
            />
            <InputField
              label="Deductions u/s 80TTA/TTB (Interest from Savings Account/FD)"
              value={deductions80TTA}
              onChange={setDeductions80TTA}
              infoText={`Max deduction: ₹${DEDUCTION_LIMITS[financialYear]['80TTA'].toLocaleString('en-IN')} (below 60) / ₹${DEDUCTION_LIMITS[financialYear]['80TTB'].toLocaleString('en-IN')} (senior citizens)`}
            />
            <InputField
              label="Employee's NPS Contribution (u/s 80CCD(1B))"
              value={npsEmployeeContribution}
              onChange={setNpsEmployeeContribution}
              infoText={`Additional deduction over 80C limit. Max: ₹${DEDUCTION_LIMITS[financialYear]['80CCD1B'].toLocaleString('en-IN')}`}
            />
            <InputField
              label="Employer's NPS Contribution (u/s 80CCD(2))"
              value={npsEmployerContribution}
              onChange={setNpsEmployerContribution}
              infoText="Deduction up to 10% of basic salary + DA (14% for Central Govt. employees). Applicable in both regimes."
            />
            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">HRA Exemption Details</h3>
            <InputField
              label="HRA Received"
              value={hraReceived}
              onChange={setHraReceived}
            />
            <InputField
              label="Rent Paid"
              value={rentPaid}
              onChange={setRentPaid}
            />
            <div className="mb-4 flex items-center">
              <input
                type="checkbox"
                id="isMetroCity"
                checked={isMetroCity}
                onChange={(e) => setIsMetroCity(e.target.checked)}
                className="form-checkbox h-4 w-4 text-indigo-600 transition duration-150 ease-in-out rounded"
              />
              <label htmlFor="isMetroCity" className="ml-2 text-gray-700 text-sm font-bold">
                Residing in a Metro City (Mumbai, Delhi, Chennai, Kolkata)
              </label>
            </div>
          </div>

          {/* Regime Selection */}
          <RadioGroup
            label="Choose Tax Regime"
            name="taxRegime"
            options={[
              { label: 'New Tax Regime (Default)', value: 'new' },
              { label: 'Old Tax Regime', value: 'old' }
            ]}
            selectedValue={selectedRegime}
            onChange={setSelectedRegime}
          />

          {/* Calculate and Reset Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-6">
            <button
              onClick={calculateTax}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-300 ease-in-out transform hover:scale-105 shadow-lg"
            >
              Calculate Tax
            </button>
            <button
              onClick={resetForm}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-300 ease-in-out transform hover:scale-105 shadow-lg"
            >
              Reset
            </button>
          </div>

          {/* Results Display */}
          {taxResults && (
            <div className="mt-8 p-6 bg-white rounded-xl shadow-2xl border border-indigo-200">
              <h2 className="text-2xl font-bold text-center text-indigo-800 mb-6">Your Tax Liability Estimate</h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Old Regime Results */}
                <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-md">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <IndianRupee size={20} className="mr-2 text-gray-600" />
                    Old Tax Regime
                  </h3>
                  <p className="text-lg mb-2">
                    <span className="font-medium">Gross Total Income:</span> ₹{(taxResults.initialGrossTotalIncome).toLocaleString('en-IN')}
                  </p>
                  <p className="text-lg mb-2">
                    <span className="font-medium">Taxable Income:</span> ₹{taxResults.oldRegime.taxableIncome.toLocaleString('en-IN')}
                  </p>
                  <p className="text-2xl font-bold text-indigo-700 mt-4">
                    Estimated Tax: ₹{Math.round(taxResults.oldRegime.totalTax).toLocaleString('en-IN')}
                  </p>
                  <div className="mt-4">
                    <h4 className="font-semibold text-gray-700">Deductions Applied:</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {taxResults.oldRegime.deductionsBreakdown.length > 0 ? (
                        taxResults.oldRegime.deductionsBreakdown.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))
                      ) : (
                        <li>No specific deductions claimed/applicable.</li>
                      )}
                    </ul>
                  </div>
                  <div className="mt-4">
                    <h4 className="font-semibold text-gray-700">Tax Calculation Breakdown:</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {taxResults.oldRegime.taxBreakdown.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* New Regime Results */}
                <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-md">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <IndianRupee size={20} className="mr-2 text-gray-600" />
                    New Tax Regime
                  </h3>
                  <p className="text-lg mb-2">
                    <span className="font-medium">Gross Total Income:</span> ₹{(taxResults.initialGrossTotalIncome).toLocaleString('en-IN')}
                  </p>
                  <p className="text-lg mb-2">
                    <span className="font-medium">Taxable Income:</span> ₹{taxResults.newRegime.taxableIncome.toLocaleString('en-IN')}
                  </p>
                  <p className="text-2xl font-bold text-indigo-700 mt-4">
                    Estimated Tax: ₹{Math.round(taxResults.newRegime.totalTax).toLocaleString('en-IN')}
                  </p>
                  <div className="mt-4">
                    <h4 className="font-semibold text-gray-700">Deductions Applied:</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {taxResults.newRegime.deductionsBreakdown.length > 0 ? (
                        taxResults.newRegime.deductionsBreakdown.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))
                      ) : (
                        <li>No specific deductions claimed/applicable.</li>
                      )}
                    </ul>
                  </div>
                  <div className="mt-4">
                    <h4 className="font-semibold text-gray-700">Tax Calculation Breakdown:</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {taxResults.newRegime.taxBreakdown.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Comparison */}
              {taxResults.oldRegime.totalTax !== taxResults.newRegime.totalTax && (
                <div className="mt-8 p-5 bg-indigo-100 rounded-lg border border-indigo-300 text-center shadow-inner">
                  <h3 className="text-xl font-bold text-indigo-800 mb-3">Tax Regime Comparison</h3>
                  {taxResults.oldRegime.totalTax < taxResults.newRegime.totalTax ? (
                    <p className="text-lg text-green-700">
                      You save ₹{Math.round(taxResults.newRegime.totalTax - taxResults.oldRegime.totalTax).toLocaleString('en-IN')} by opting for the <span className="font-bold">Old Tax Regime</span>.
                    </p>
                  ) : (
                    <p className="text-lg text-green-700">
                      You save ₹{Math.round(taxResults.oldRegime.totalTax - taxResults.newRegime.totalTax).toLocaleString('en-IN')} by opting for the <span className="font-bold">New Tax Regime</span>.
                    </p>
                  )}
                </div>
              )}
              {taxResults.oldRegime.totalTax === taxResults.newRegime.totalTax && (
                 <div className="mt-8 p-5 bg-gray-100 rounded-lg border border-gray-300 text-center shadow-inner">
                    <p className="text-lg text-gray-700">
                      Your tax liability is the same under both tax regimes.
                    </p>
                 </div>
              )}
            </div>
          )}

          <div className="mt-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-sm text-yellow-800">
            <p className="font-bold">Disclaimer:</p>
            <p>This calculator provides an *estimate* of your income tax liability based on the information provided and publicly available tax laws for the selected financial year. It does not account for all possible scenarios, specific exemptions, or complex tax situations (e.g., business income, foreign income, specific capital gains rules, clubbing of income, alternative minimum tax, etc.). The capital gains calculation assumes the gains are from assets typically covered by Section 111A (STCG) and Section 112A (LTCG), such as listed equity shares and equity-oriented mutual funds, where Securities Transaction Tax (STT) is paid. Tax laws are subject to change. For accurate tax planning and filing, please consult a qualified tax professional or refer to the official Income Tax Department of India website.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
