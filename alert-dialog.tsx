/* Tyre Replenishment Planning System - Styles */

/* Print Styles */
@media print {
  @page {
    size: A4 landscape;
    margin: 15mm;
  }

  body {
    background: white !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .print\:hidden {
    display: none !important;
  }

  .print\:block {
    display: block !important;
  }

  .print\:grid-cols-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  main {
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .max-w-\[1600px\] {
    max-width: none !important;
  }

  .shadow-sm,
  .shadow-lg {
    box-shadow: none !important;
    border: 1px solid #e5e7eb !important;
  }

  .bg-\[\#051c2c\] {
    background-color: #051c2c !important;
    color: white !important;
  }

  .bg-gradient-to-r {
    background: #051c2c !important;
  }

  /* Ensure charts are visible */
  canvas {
    max-height: 200px !important;
  }

  /* Table styling for print */
  table {
    font-size: 10px !important;
  }

  th, td {
    padding: 4px 6px !important;
  }

  /* Page breaks */
  .mb-6 {
    margin-bottom: 15px !important;
  }
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Slider Customization */
[data-slot="slider-track"] {
  background-color: #e5e7eb !important;
}

[data-slot="slider-range"] {
  background-color: #c9a227 !important;
}

[data-slot="slider-thumb"] {
  background-color: #c9a227 !important;
  border-color: #c9a227 !important;
}

/* Badge Status Colors */
.badge-normal {
  background-color: #dcfce7;
  color: #166534;
  border-color: #86efac;
}

.below-rop {
  background-color: #fef9c3;
  color: #854d0e;
  border-color: #fde047;
}

.badge-stockout {
  background-color: #fee2e2;
  color: #991b1b;
  border-color: #fca5a5;
}

.badge-delivery {
  background-color: #dbeafe;
  color: #1e40af;
  border-color: #93c5fd;
}

/* Card Hover Effects */
.card-hover {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
}

/* Animation for alerts */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.alert-animate {
  animation: slideIn 0.3s ease-out;
}

/* Chart container */
.chart-container {
  position: relative;
  height: 100%;
  width: 100%;
}

/* Table row hover */
.table-row-hover:hover {
  background-color: #f8fafc !important;
}

/* Focus states */
input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: #c9a227 !important;
  box-shadow: 0 0 0 2px rgba(201, 162, 39, 0.2) !important;
}

/* Button transitions */
button {
  transition: all 0.2s ease;
}

button:active {
  transform: scale(0.98);
}

/* Tooltip styling */
[data-slot="tooltip-content"] {
  background-color: #051c2c !important;
  color: white !important;
  border: 1px solid #c9a227 !important;
}

/* Tabs styling */
[data-state="active"][role="tab"] {
  background-color: #051c2c !important;
  color: white !important;
}

/* Responsive adjustments */
@media (max-width: 1280px) {
  aside {
    width: 340px !important;
  }
}

@media (max-width: 1024px) {
  .max-w-\[1600px\] {
    flex-direction: column;
  }

  aside {
    width: 100% !important;
    position: relative !important;
  }

  .grid-cols-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 768px) {
  .grid-cols-4 {
    grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
  }

  .grid-cols-2 {
    grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
  }

  header .flex.items-center.gap-2 {
    flex-wrap: wrap;
  }
}

/* Loading state */
.loading-shimmer {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
