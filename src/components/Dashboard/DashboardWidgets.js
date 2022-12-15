import React from "react";
import { useSelector } from "react-redux";
import {
  getAllInvoiceSelector,
  getTotalBalance,
} from "../../store/invoiceSlice";
import { NumericFormat } from 'react-number-format';

function DashboardWidgets() {
  const totalBalance = useSelector(getTotalBalance);
  const allInvoices = useSelector(getAllInvoiceSelector);

  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full mb-3 md:w-1/2">
          <div className="p-4 bg-white rounded-xl md:mr-4 hover:shadow-sm">
            <div className="font-title">Total Balance</div>
            <div className="flex justify-between items-center text-2xl mr-2">
              <NumericFormat
                value={totalBalance}
                className=""
                displayType={"text"}
                thousandSeparator={true}
                renderText={(value, props) => <span {...props}>{value}</span>}
              />
            </div>
          </div>
        </div>
        <div className="w-full mb-3 md:w-1/2">
          <div className="p-4 bg-white rounded-xl md:mr-4 hover:shadow-sm">
            <div className="font-title">Total Invoices</div>
            <div className="flex justify-between items-center text-2xl mr-2">
              <NumericFormat
                value={allInvoices?.length}
                className=""
                displayType={"text"}
                thousandSeparator={true}
                renderText={(value, props) => <span {...props}>{value}</span>}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default DashboardWidgets;
