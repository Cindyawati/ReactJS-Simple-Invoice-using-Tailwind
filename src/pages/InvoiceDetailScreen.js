import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import DatePicker from "react-datepicker";
import { useReactToPrint } from "react-to-print";
import { useDispatch, useSelector } from "react-redux";
import { NumericFormat } from 'react-number-format';
import { toast } from "react-toastify";
import domtoimage from "dom-to-image";
import InvoiceTopBar from "../components/Invoice/InvoiceTopBar";
import {
  getAllInvoiceDetailSelector,
  getCurrentBGImage,
  getCurrentColor,
  getInvoiceNewForm,
  getIsConfirm,
  setConfirmModalOpen,
  setDefaultBackground,
  setDefaultColor,
  setIsConfirm,
  setNewInvoices,
  updateExisitingInvoiceForm,
  updateNewInvoiceForm,
} from "../store/invoiceSlice";
import {
  getSelectedClient,
} from "../store/clientSlice";
import { getCompanyData } from "../store/companySlice";
import { defaultInputSmStyle, IconStyle } from "../constants/defaultStyles";
import Button from "../components/Button/Button";
import { nanoid } from "nanoid";
import DeleteIcon from "../components/Icons/DeleteIcon";
import {
  getSelectedProduct,
} from "../store/productSlice";
import { useAppContext } from "../context/AppContext";
import DollarIcon from "../components/Icons/DollarIcon"; //Save as Unpaid
import CheckCircleIcon from "../components/Icons/CheckCircleIcon"; //Save as Draft
import SecurityIcon from "../components/Icons/SecurityIcon"; //Save as Paid
import {
  getTotalTaxesWithPercent,
  sumProductTotal,
  sumTotalAmount,
  sumTotalTaxes,
} from "../utils/match"; //Calculate Total
import PageTitle from "../components/Common/PageTitle";

function InvoiceDetailScreen(props) {
  const { initLoading, showNavbar, toggleNavbar, setEscapeOverflow } =
    useAppContext();
  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const componentRef = useRef(null);
  const reactToPrintContent = useCallback(() => {
    return componentRef.current;
  }, []);
  const handlePrint = useReactToPrint({
    content: reactToPrintContent,
    documentTitle: "Invoice Letter",
    onAfterPrint: useCallback(() => {
      setIsExporting(false);
      setEscapeOverflow(false);
    }, [setEscapeOverflow]),
    removeAfterPrint: true,
  });

  const invoiceNewForm = useSelector(getInvoiceNewForm);
  const allInvoiceDetails = useSelector(getAllInvoiceDetailSelector);
  const company = useSelector(getCompanyData);
  const selectedClient = useSelector(getSelectedClient);
  const selectedProduct = useSelector(getSelectedProduct);
  const currentBg = useSelector(getCurrentBGImage);
  const currentColor = useSelector(getCurrentColor);
  const isConfirm = useSelector(getIsConfirm);

  const [invoiceForm, setInvoiceForm] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [statusData, setStatusData] = useState({
    statusName: "Draft",
    statusIndex: 1,
  });

  const handleExport = useCallback(() => {
    if (showNavbar) {
      toggleNavbar();
    }
    setEscapeOverflow(true);
    setIsViewMode(true);
    setIsExporting(true);
    setTimeout(() => {
      handlePrint();
    }, 3000);
  }, [handlePrint, setEscapeOverflow, showNavbar, toggleNavbar]);

  const handleDownloadImg = useCallback(() => {
    if (showNavbar) {
      toggleNavbar();
    }
    setEscapeOverflow(true);
    setIsViewMode(true);
    setIsExporting(true);
    domtoimage
      .toJpeg(componentRef.current, { quality: 1 })
      .then(async (dataUrl) => {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          let a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "invoice.jpeg";
          a.hidden = true;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch (e) {
          console.log(e);
        } finally {
          setIsExporting(false);
          setEscapeOverflow(false);
        }
      });
  }, [setEscapeOverflow, showNavbar, toggleNavbar]);

  const toggleViewMode = useCallback(() => {
    if (invoiceForm.statusIndex !== "1" && isViewMode) {
      toast.warn("You can only edit on Draft Mode", {
        position: "bottom-center",
        autoClose: 3000,
      });
      return;
    }
    setIsViewMode((prev) => !prev);
  }, [invoiceForm, isViewMode]);

  const addEmptyProduct = useCallback(() => {
    const emptyProduct = {
      id: nanoid(),
      name: "",
      productID: "",
      amount: 1,
      quantity: 1,
    };

    setInvoiceForm((prev) => {
      let updatedData = { ...prev };
      const updateProducts = [...prev.products, emptyProduct];
      const subTotalAmount = sumProductTotal(updateProducts);
      const updateTaxes = getTotalTaxesWithPercent(prev.taxes, subTotalAmount);
      updatedData.products = updateProducts;
      updatedData.taxes = updateTaxes;
      updatedData.totalAmount = sumTotalAmount(
        subTotalAmount,
        sumTotalTaxes(updateTaxes)
      );
      return updatedData;
    });
  }, []);

  const onDeleteProduct = useCallback((prodID) => {
    setInvoiceForm((prev) => {
      let updatedData = { ...prev };
      const updateProducts = prev.products.filter((prod) => prod.id !== prodID);
      const subTotalAmount = sumProductTotal(updateProducts);
      const updateTaxes = getTotalTaxesWithPercent(prev.taxes, subTotalAmount);
      updatedData.products = updateProducts;
      updatedData.taxes = updateTaxes;
      updatedData.totalAmount = sumTotalAmount(
        subTotalAmount,
        sumTotalTaxes(updateTaxes)
      );
      return updatedData;
    });
  }, []);

  const handlerInvoiceValue = useCallback((event, keyName) => {
    const value =
      typeof event === "string" ? new Date(event) : event?.target?.value;

    setInvoiceForm((prev) => {
      return { ...prev, [keyName]: value };
    });
  }, []);

  const handlerProductValue = useCallback(
    (event, keyName, productID) => {
      const value = event.target.value;

      // If Keyname Price or Quantity must be only number
      if (keyName === "quantity") {
        if (!`${value}`.match(/^\d+$/)) {
          return;
        }
      }

      if (keyName === "amount") {
        if (!`${value}`.match(/^[0-9]\d*(\.\d+)?$/)) {
          return;
        }
      }

      // Quantity Zero Case
      if ((keyName === "quantity" || keyName === "amount") && value <= 0) {
        return;
      }

      let updatedData = { ...invoiceForm };
      let updateProducts = [...invoiceForm.products];

      const isFindIndex = updateProducts.findIndex(
        (prod) => prod.id === productID
      );

      if (isFindIndex !== -1) {
        updateProducts[isFindIndex] = {
          ...updateProducts[isFindIndex],
          [keyName]: value,
        };

        updatedData.products = [...updateProducts];
      }

      if (keyName === "quantity" || keyName === "amount") {
        const subTotalAmount = sumProductTotal(updateProducts);
        const updateTaxes = getTotalTaxesWithPercent(
          invoiceForm.taxes,
          subTotalAmount
        );
        updatedData.taxes = updateTaxes;
        updatedData.totalAmount = sumTotalAmount(
          subTotalAmount,
          sumTotalTaxes(updateTaxes)
        );
      }
      setInvoiceForm(updatedData);
    },
    [invoiceForm]
  );

  const handlerInvoiceClientValue = useCallback((event, keyName) => {
    const value =
      typeof event === "string" ? new Date(event) : event?.target?.value;

    setInvoiceForm((prev) => {
      return {
        ...prev,
        clientDetail: { ...prev.clientDetail, [keyName]: value },
      };
    });
  }, []);

  // Calculate Sub Total
  const subTotal = useMemo(() => {
    if (!invoiceForm) {
      return 0;
    }

    if (!invoiceForm?.products) {
      return 0;
    }
    return sumProductTotal(invoiceForm.products);
  }, [invoiceForm]);

  const saveAs = useCallback(
    (status) => {
      setStatusData({
        statusIndex: status === "Draft" ? "1" : status === "Unpaid" ? "2" : "3",
        statusName: status,
      });
      dispatch(setConfirmModalOpen(true));
    },
    [dispatch]
  );

  const goInvoiceList = useCallback(() => {
    navigate("/pages");
  }, [navigate]);

  useEffect(() => {
    if (selectedProduct !== null) {
      // If Choosen Exisiting Client And This form is news
      const { name, productID, amount } = selectedProduct;
      const newProduct = {
        id: nanoid(),
        name,
        productID,
        amount,
        quantity: 1,
      };

      setInvoiceForm((prev) => {
        let updatedData = { ...prev };
        const updateProducts = [...prev.products, newProduct];
        const subTotalAmount = sumProductTotal(updateProducts);
        const updateTaxes = getTotalTaxesWithPercent(
          prev.taxes,
          subTotalAmount
        );
        updatedData.products = updateProducts;
        updatedData.taxes = updateTaxes;
        updatedData.totalAmount = sumTotalAmount(
          subTotalAmount,
          sumTotalTaxes(updateTaxes)
        );
        return updatedData;
      });
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (initLoading === false) {
      if (params.id === "new" && invoiceForm === null) {
        // If New I ignore Company Data,
        // Everytime we set current company Data
        setInvoiceForm({
          ...invoiceNewForm,
          companyDetail: { ...company },
          dueDate: new Date(invoiceNewForm.dueDate),
          createdDate: new Date(),
        });

        dispatch(setDefaultBackground(invoiceNewForm.backgroundImage));
        dispatch(setDefaultColor(invoiceNewForm.color));
      } else if (params.id !== "new" && invoiceForm === null) {
        // Else Exisiting Invoice,
        // We'll Set Company Data
        // But if it's Draft, we'll currenty set the data for Current Company Data
        // Because it's still Draft State
        const getInvoiceDetail = allInvoiceDetails.find(
          (inv) => inv.id === params.id
        );

        // If not Found Redirect Back
        // navigate("/");
        if (!getInvoiceDetail) {
          navigate("/invoices");
          return;
        } else {
          setInvoiceForm({
            ...getInvoiceDetail,
            companyDetail: { ...getInvoiceDetail.companyDetail },
            dueDate: new Date(getInvoiceDetail.dueDate),
            createdDate: new Date(getInvoiceDetail.createdDate),
          });

          dispatch(setDefaultBackground(getInvoiceDetail.backgroundImage));
          dispatch(setDefaultColor(getInvoiceDetail.color));
          setIsViewMode(true);
        }
      }
    }
  }, [
    params,
    invoiceForm,
    navigate,
    invoiceNewForm,
    initLoading,
    company,
    dispatch,
    allInvoiceDetails,
  ]);

  useEffect(() => {
    if (selectedClient !== null) {
      // If Choosen Exisiting Client And This form is news
      setInvoiceForm((prev) => {
        return {
          ...prev,
          clientDetail: { ...selectedClient },
        };
      });
    }
  }, [selectedClient]);

  useEffect(() => {
    // if (invoiceForm.produ)
    if (params.id === "new" && invoiceForm !== null) {
      dispatch(updateNewInvoiceForm(invoiceForm));
    } else if (params.id !== "new" && invoiceForm !== null) {
      dispatch(updateExisitingInvoiceForm(invoiceForm));
    }
  }, [dispatch, invoiceForm, params]);

  useEffect(() => {
    if (initLoading === false) {
      setInvoiceForm((prev) => ({
        ...prev,
        backgroundImage: currentBg,
        color: currentColor,
      }));
    }
  }, [currentBg, currentColor, initLoading]);

  // On Confirm Dependencies
  useEffect(() => {
    if (isConfirm) {
      const isNew = params.id === "new";
      if (isNew) {
        dispatch(setIsConfirm(false));
        dispatch(setNewInvoices({ ...invoiceForm, ...statusData }));
        setInvoiceForm({
          ...invoiceForm,
          products: [
            {
              amount: 1200,
              id: nanoid(),
              name: "productName",
              productID: "",
              quantity: 1,
            },
          ],
          taxes: [],
          totalAmount: 1200,
        });

        setTimeout(() => {
          navigate("/pages");
        }, 300);
      } else {
        // Update Exisiting Invoice
        dispatch(setIsConfirm(false));
        setIsViewMode(true);
        setInvoiceForm({
          ...invoiceForm,
          ...statusData,
        });
      }
    }
  }, [dispatch, invoiceForm, isConfirm, navigate, params, statusData]);

  return (
    <div>
      <div className="p-4">
        <PageTitle
          title={
            <>
              {params.id === "new"
                ? "New Invoice"
                : `Invoice Detail ${invoiceForm?.statusName}`}
            </>
          }
        />
      </div>
      <div className="px-4 pb-3">
        <InvoiceTopBar
          onClickBack={goInvoiceList}
          viewMode={isViewMode}
          onClickViewAs={toggleViewMode}
          onClickExport={handleExport}
          onClickDownloadImg={handleDownloadImg}
        />
      </div>

      {invoiceForm && (
        <div
          className={
            isExporting
              ? "bg-white mb-1 pt-1 px-1 "
              : "bg-white mx-4 rounded-xl mb-1"
          }
          id="InvoiceWrapper"
          ref={componentRef}
          style={isExporting ? { width: 1200 } : {}}
        >
          {/* Background Image */}
          <div
            className={
              isExporting
                ? "py-5 px-8 bg-cover bg-center bg-slate-50 rounded-xl flex flex-row justify-between items-center"
                : "py-9 px-8 bg-cover bg-center bg-slate-50 rounded-xl flex flex-col sm:flex-row justify-between items-center"
            }
            style={{
              backgroundImage: `url(${invoiceForm?.backgroundImage?.base64})`,
            }}
          >
            <div
              className={
                isExporting
                  ? "flex xflex-row items-center"
                  : "flex flex-col sm:flex-row items-center"
              }
            >
              {invoiceForm?.companyDetail?.image ? (
                <img
                  className="object-contain h-20 w-20 mr-3 rounded"
                  alt={invoiceForm?.companyDetail?.companyName}
                  src={invoiceForm?.companyDetail?.image}
                />
              ) : (
                <span></span>
              )}

              <div
                className={
                  isExporting
                    ? "text-white font-title text-left"
                    : "text-white font-title text-center sm:text-left"
                }
              >
                <p className="font-bold mb-2">
                  {invoiceForm?.companyDetail?.companyName || "Company Name"}
                </p>
                <p className="text-sm font-medium">
                  {invoiceForm?.companyDetail?.billingAddress ||
                    "Plz add First Company Data"}
                </p>
                <p className="text-sm font-medium">
                  {invoiceForm?.companyDetail?.companyMobile || "Company Ph"}
                </p>
                <p className="text-sm font-medium">
                  {invoiceForm?.companyDetail?.companyEmail ||
                    "Company@email.com"}
                </p>
              </div>
            </div>
            <div className="text-white font-title font-bold text-5xl mt-5 sm:mt-0">Invoice</div>
          </div>
          {/* Background Image Finished */}

          {/* Customer Billing Info */}
          <div
            className={
              isExporting
                ? "flex flex-row pt-2 px-8"
                : "flex flex-col sm:flex-row pt-3 px-8"
            }
          >
            {/* Left Side */}
            <div className="flex-1">
              <div className="flex flex-row">
                <div className="font-title font-bold mt-4 mb-4">Billing To</div>
                <div className="w-1/2 relative ml-3" style={{ top: "-3px" }}>
                </div>
              </div>
              <div className="client-form-wrapper sm:w-1/2">
                <div
                  className={
                    "font-medium " + (isExporting ? "text-xs" : "text-sm mb-1")
                  }
                >
                  {!isViewMode ? (
                    <input
                      autoComplete="nope"
                      placeholder="Client Name"
                      className={defaultInputSmStyle}
                      value={invoiceForm?.clientDetail?.name}
                      onChange={(e) => handlerInvoiceClientValue(e, "name")}
                    />
                  ) : (
                    invoiceForm?.clientDetail?.name
                  )}
                </div>
                <div
                  className={
                    "font-medium " + (isExporting ? "text-xs" : "text-sm mb-1")
                  }
                >
                  {!isViewMode ? (
                    <input
                      autoComplete="nope"
                      placeholder="Client Address"
                      className={defaultInputSmStyle}
                      value={invoiceForm?.clientDetail?.billingAddress}
                      onChange={(e) =>
                        handlerInvoiceClientValue(e, "billingAddress")
                      }
                    />
                  ) : (
                    invoiceForm?.clientDetail?.billingAddress
                  )}
                </div>
                <div
                  className={
                    "font-medium " + (isExporting ? "text-xs" : "text-sm mb-1")
                  }
                >
                  {!isViewMode ? (
                    <input
                      autoComplete="nope"
                      placeholder="Client Mobile"
                      className={defaultInputSmStyle}
                      value={invoiceForm?.clientDetail?.mobileNo}
                      onChange={(e) => handlerInvoiceClientValue(e, "mobileNo")}
                    />
                  ) : (
                    invoiceForm?.clientDetail?.mobileNo
                  )}
                </div>
                <div
                  className={
                    "font-medium " + (isExporting ? "text-xs" : "text-sm mb-1")
                  }
                >
                  {!isViewMode ? (
                    <input
                      autoComplete="nope"
                      placeholder="Client Email"
                      className={defaultInputSmStyle}
                      value={invoiceForm?.clientDetail?.email}
                      onChange={(e) => handlerInvoiceClientValue(e, "email")}
                    />
                  ) : (
                    invoiceForm?.clientDetail?.email
                  )}
                </div>
              </div>
            </div>

            {/* Right Side */}
            <div className="mt-14">
              <div className="flex-1">
                <div className="flex flex-row justify-between items-center mb-1">
                  <div className="font-title flex-1"> INVOICE # </div>
                  <div className="font-title flex-1 text-right">
                    {!isViewMode ? (
                      <input
                        autoComplete="nope"
                        placeholder="Invoice No"
                        className={defaultInputSmStyle + " text-right"}
                        value={invoiceForm.invoiceNo}
                        onChange={(e) => handlerInvoiceValue(e, "invoiceNo")}
                      />
                    ) : (
                      invoiceForm.invoiceNo || "-"
                    )}
                  </div>
                </div>
                <div className="flex flex-row justify-between items-center mb-1">
                  <div className="font-title flex-1"> Creation Date </div>
                  <div className="font-title flex-1 text-right">
                    <DatePicker
                      selected={invoiceForm.createdDate}
                      onChange={(date) =>
                        handlerInvoiceValue(date.toISOString(), "createdDate")
                      }
                      disabled={true}
                      className={
                        !isViewMode
                          ? defaultInputSmStyle + " border-gray-300 text-right"
                          : " text-right bg-white"
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-row justify-between items-center mb-1">
                  <div className="font-title flex-1"> Due Date </div>
                  <div className="font-title flex-1 text-right">
                    <DatePicker
                      selected={invoiceForm.dueDate}
                      onChange={(date) =>
                        handlerInvoiceValue(date.toISOString(), "dueDate")
                      }
                      disabled={isViewMode}
                      className={
                        !isViewMode
                          ? defaultInputSmStyle + " border-gray-300 text-right"
                          : " text-right bg-white"
                      }
                    />
                  </div>
                </div>
                {!isViewMode && (
                  <div className="flex flex-row justify-between items-center mb-1">
                    <div className="font-title flex-1"> Change Currency </div>
                    <div className="font-title flex-1 text-right">
                      <input
                        autoComplete="nope"
                        placeholder="Invoice No"
                        className={defaultInputSmStyle + " text-right"}
                        value={invoiceForm.currencyUnit}
                        onChange={(e) => handlerInvoiceValue(e, "currencyUnit")}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
          {/* Customer Billing Info Finished */}

          {/* Products */}
          <div className="py-2 px-4">

            {/* Header Table */}
            <div className="mt-4">
              <div
                className={
                  isExporting
                    ? "flex rounded-lg w-full flex-row px-4 py-1 text-white"
                    : "hidden sm:flex rounded-lg invisible sm:visible w-full flex-col sm:flex-row px-4 py-2 text-white"
                }
                style={{ backgroundColor: invoiceForm.color }}
              >
                <div
                  className={"font-title " + (isExporting
                      ? " text-sm w-1/4 text-right pr-10"
                      : " w-full sm:w-1/4 text-right sm:pr-10")
                  }>
                  Product Name
                </div>

                <div
                  className={
                    "font-title " + (isExporting
                      ? " text-sm  w-1/4 text-right pr-10"
                      : " w-full sm:w-1/4 text-right sm:pr-10")
                  }>
                  Price
                </div>
                <div
                  className={
                    "font-title " +
                    (isExporting
                      ? " text-sm  w-1/4 text-right pr-10"
                      : " w-full sm:w-1/4 text-right sm:pr-10")
                  }
                >
                  Qty
                </div>
                <div
                  className={
                    "font-title" +
                    (isExporting
                      ? " text-sm w-1/4 text-right pr-10"
                      : "  w-full sm:w-1/4 text-right sm:pr-10")
                  }
                >
                  Total
                </div>
              </div>
            </div>
            
            {/* Form */}
            <div className="mt-4">
              {invoiceForm?.products?.map((product, index) => (
                <div
                  key={`${index}_${product.id}`}
                  className={
                    (isExporting
                      ? "flex flex-row rounded-lg w-full px-4 py-1 items-center relative text-sm"
                      : "flex flex-col sm:flex-row rounded-lg sm:visible w-full px-4 py-2 items-center relative") +
                    (index % 2 !== 0 ? " bg-gray-50 " : "")
                  }
                >
                  {/* Product Name*/}
                  <div 
                    className={
                      isExporting
                        ? "font-title w-1/4 text-right pr-8 flex flex-row block"
                        : "font-title w-full sm:w-1/4 text-right sm:pr-8 flex flex-row sm:block"
                    }
                  >
                    {!isExporting && (
                      <span className="sm:hidden w-1/2 flex flex-row items-center">
                        Product Name
                      </span>
                    )}
                    <span
                      className={
                        isExporting
                          ? "inline-block w-full mb-0"
                          : "inline-block w-1/2 sm:w-full mb-1 sm:mb-0"
                      }
                    >
                      {!isViewMode ? (
                        <input
                          autoComplete="nope"
                          value={product.name}
                          placeholder="Product Name"
                          className={defaultInputSmStyle + " text-right"}
                          onChange={(e) =>
                            handlerProductValue(e, "name", product.id)
                          }
                        />
                      ) : (
                        <span className="pr-3">{product.name}</span>
                      )}
                    </span>
                  </div>

                  {/* Price */}
                  <div
                    className={
                      isExporting
                        ? "font-title w-1/4 text-right pr-8 flex flex-row block"
                        : "font-title w-full sm:w-1/4 text-right sm:pr-8 flex flex-row sm:block"
                    }
                  >
                    {!isExporting && (
                      <span className="sm:hidden w-1/2 flex flex-row items-center">
                        Price
                      </span>
                    )}
                    <span
                      className={
                        isExporting
                          ? "inline-block w-full mb-0"
                          : "inline-block w-1/2 sm:w-full mb-1 sm:mb-0"
                      }
                    >
                      {!isViewMode ? (
                        <input
                          autoComplete="nope"
                          value={product.amount}
                          placeholder="Price"
                          type={"number"}
                          className={defaultInputSmStyle + " text-right"}
                          onChange={(e) =>
                            handlerProductValue(e, "amount", product.id)
                          }
                        />
                      ) : (
                        <span className="pr-3">
                          <NumericFormat
                            value={product.amount}
                            className=""
                            displayType={"text"}
                            thousandSeparator={true}
                            renderText={(value, props) => (
                              <span {...props}>{value}</span>
                            )}
                          />
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Quantity */}
                  <div
                    className={
                      isExporting
                        ? "font-title w-1/4 text-right pr-8 flex flex-row block"
                        : "font-title w-full sm:w-1/4 text-right sm:pr-8 flex flex-row sm:block"
                    }
                  >
                    {!isExporting && (
                      <span className="sm:hidden w-1/2 flex flex-row items-center">
                        Quantity
                      </span>
                    )}
                    <span
                      className={
                        isExporting
                          ? "inline-block w-full mb-0"
                          : "inline-block w-1/2 sm:w-full mb-1 sm:mb-0"
                      }
                    >
                      {!isViewMode ? (
                        <input
                          autoComplete="nope"
                          value={product.quantity}
                          type={"number"}
                          placeholder="Quantity"
                          className={defaultInputSmStyle + " text-right"}
                          onChange={(e) =>
                            handlerProductValue(e, "quantity", product.id)
                          }
                        />
                      ) : (
                        <span className="pr-3">
                          <NumericFormat
                            value={product.quantity}
                            className=""
                            displayType={"text"}
                            thousandSeparator={true}
                            renderText={(value, props) => (
                              <span {...props}>{value}</span>
                            )}
                          />
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Total */}
                  <div
                    className={
                      isExporting
                        ? "font-title w-1/4 text-right pr-9 flex flex-row `1block"
                        : "font-title w-full sm:w-1/4 text-right sm:pr-9 flex flex-row sm:block"
                    }
                  >
                    {!isExporting && (
                      <span className="sm:hidden w-1/2 flex flex-row items-center">
                        Total
                      </span>
                    )}

                    <span
                      className={
                        isExporting
                          ? "inline-block w-full "
                          : "inline-block w-1/2 sm:w-full"
                      }
                    >
                      <NumericFormat
                        value={
                          Number.isInteger(product.quantity * product.amount)
                            ? product.quantity * product.amount
                            : (product.quantity * product.amount)
                                .toFixed(4)
                                .toString()
                                .slice(0, -2)
                        }
                        className=""
                        displayType={"text"}
                        thousandSeparator={true}
                        renderText={(value, props) => (
                          <span {...props}>{value}</span>
                        )}
                      />{" "}
                      {invoiceForm?.currencyUnit}
                    </span>
                  </div>

                  {/* Delete Product */}
                  {!isViewMode && (
                    <div
                      className="w-full sm:w-10 sm:absolute sm:right-0"
                      onClick={() => onDeleteProduct(product.id)}
                    >
                      <div className="w-full text-red-500 font-title h-8 sm:h-8 sm:w-8 cursor-pointer rounded-2xl bg-red-200 mr-2 flex justify-center items-center">
                        <DeleteIcon className="h-4 w-4" style={IconStyle} />
                        <span className="block sm:hidden">Delete Product</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add Product Actions */}
            {!isViewMode && (
              <div class="flex space-x-2 float-left ml-4 mt-4">
              <button type="button" class="inline-block px-3 py-2.5 bg-blue-600 text-white font-medium text-xs leading-tight uppercase rounded shadow-md hover:bg-blue-700 hover:shadow-lg focus:bg-blue-700 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-blue-800 active:shadow-lg transition duration-150 ease-in-out" block={1} onClick={addEmptyProduct}>
                Add Item
              </button>
            </div>
            )}
            {/* Add Product Actions Finished*/}

            {/* Subtotal Start */}
            <div
              className={
                isExporting
                  ? "flex flex-row rounded-lg w-full px-4 py-1 justify-end items-end relative text-sm"
                  : "flex flex-row sm:flex-row sm:justify-end rounded-lg sm:visible w-full px-4 py-1 items-center "
              }
            >
              <div
                className={
                  isExporting
                    ? "font-title w-1/4 text-right pr-9 flex flex-row block justify-end text-sm "
                    : "font-title w-1/2 sm:w-1/4 text-right sm:pr-8 flex flex-row sm:block mb-1 sm:mb-0"
                }
              >
                Subtotal
              </div>
              <div
                className={
                  isExporting
                    ? "font-title w-1/4 text-right pr-9 flex flex-row block justify-end text-sm "
                    : "font-title w-1/2 sm:w-1/4 text-right sm:pr-9 flex flex-row justify-end sm:block mb-1"
                }
              >
                <NumericFormat
                  value={subTotal}
                  className="inline-block"
                  displayType={"text"}
                  thousandSeparator={true}
                  renderText={(value, props) => (
                    <span {...props}>
                      {value} {invoiceForm?.currencyUnit}
                    </span>
                  )}
                />
              </div>
            </div>
            {/* Subtotal Finished */}

            {/* Total Paid */}
            <div
              className={
                isExporting
                  ? "flex flex-row rounded-lg w-full px-4 py-1 justify-end items-end relative text-sm"
                  : "flex flex-row sm:flex-row sm:justify-end rounded-lg sm:visible w-full px-4 py-1 items-center "
              }
            >
              <div
                className={
                  isExporting
                    ? "font-title w-1/4 text-right pr-9 flex flex-row block justify-end text-sm "
                    : "font-title w-1/2 sm:w-1/4 text-right sm:pr-8 flex flex-row sm:block mb-1 sm:mb-0"
                }
              >
                Total Paid
              </div>
              <div
                className={
                  isExporting
                    ? "font-title w-1/4 text-right pr-9 flex flex-row block justify-end text-sm "
                    : "font-title w-1/2 sm:w-1/4 text-right sm:pr-9 flex flex-row justify-end sm:block mb-1"
                }
              >
                <NumericFormat
                  value={subTotal}
                  className="inline-block"
                  displayType={"text"}
                  thousandSeparator={true}
                  renderText={(value, props) => (
                    <span {...props}>
                      {value} {invoiceForm?.currencyUnit}
                    </span>
                  )}
                />
              </div>
            </div>
            {/* Total Paid Finished */}

            {/* Amount Due */}
            <div
              className={
                isExporting
                  ? "flex flex-row rounded-lg w-full px-4 py-1 justify-end items-end relative text-sm"
                  : "flex flex-row sm:flex-row sm:justify-end rounded-lg sm:visible w-full px-4 py-1 items-center "
              }
            >
              <div
                className={
                  isExporting
                    ? "font-title w-1/4 text-right pr-9 flex flex-row block justify-end text-sm "
                    : "font-title w-1/2 sm:w-1/4 text-right sm:pr-8 flex flex-row sm:block mb-1 sm:mb-0"
                }
              >
                Amount Due
              </div>
              <div
                className={
                  isExporting
                    ? "font-title w-1/4 text-right pr-9 flex flex-row block justify-end text-sm "
                    : "font-title w-1/2 sm:w-1/4 text-right sm:pr-9 flex flex-row justify-end sm:block mb-1"
                }
              >
                <NumericFormat
                  value={"0"}
                  className="inline-block"
                  displayType={"text"}
                  thousandSeparator={true}
                  renderText={(value, props) => (
                    <span {...props}>{value} {invoiceForm?.currencyUnit}</span>
                  )}
                />
              </div>
            </div>
            {/* Amount Due Finished */}

          </div>
          {/* Products Finished */}

          {/* Notes */}
          <div
            className={
              isExporting
                ? "flex flex-row pt-2 px-8"
                : "flex flex-col sm:flex-row pt-3 px-8"
            }
          >
            <div className="w-full">
                <div className="flex flex-row">
                  <div className="font-title font-bold mb-4">Additional Notes</div>
                  <div className="w-1/2 relative ml-3" style={{ top: "-3px" }}>
                  </div>
                </div>
                <div className="client-form-wrapper sm:w-1/2">
                  <div
                    className={
                      "font-medium " + (isExporting ? "text-xs" : "text-sm mb-1")
                    }
                  >
                    {!isViewMode ? (
                      <input
                        autoComplete="nope"
                        placeholder="Notes"
                        className={defaultInputSmStyle}
                        value={invoiceForm?.clientDetail?.notes}
                        onChange={(e) => handlerInvoiceClientValue(e, "notes")}
                      />
                    ) : (
                      invoiceForm?.clientDetail?.notes
                    )}
                  </div>
                  <div
                    className={
                      "font-medium " + (isExporting ? "text-xs" : "text-sm mb-1")
                    }
                  >
                  </div>
                </div>
            </div>
          </div>

          {/* Payment */}

          <div
            className={
              isExporting
                ? "flex flex-row pt-2 px-8"
                : "flex flex-col sm:flex-row pt-3 px-8"
            }
          >

            <div className="w-full">
              <div className="flex flex-row">
                <div className="font-title font-bold mt-4 mb-4">Payment</div>
                <div className="w-1/2 relative ml-3" style={{ top: "-3px" }}>
                </div>
              </div>
              <div className="client-form-wrapper sm:w-1/2">
                <div className={"font-medium " + (isExporting ? "text-xs" : "text-sm mb-1")}>
                  1. Login to m-banking.
                </div>
                <div className={"font-medium " + (isExporting ? "text-xs" : "text-sm mb-1")}>
                  2. Select m-transfer.
                </div>
                <div className={"font-medium " + (isExporting ? "text-xs" : "text-sm mb-1")}>
                  3. Enter destination account number.
                </div>
                <div className={"font-medium " + (isExporting ? "text-xs" : "text-sm mb-1")}>
                  4. Enter nominal.
                </div>
                <div className={"font-medium " + (isExporting ? "text-xs" : "text-sm mb-1")}>
                  5. Enter your PIN.
                </div>
                <div className={"font-medium " + (isExporting ? "text-xs" : "text-sm mb-1")}>
                  6. Click send.
                </div>
                <div
                  className={
                    "font-medium " + (isExporting ? "text-xs" : "text-sm mb-1")
                  }
                >
                </div>
              </div>
            </div>

          </div>

        </div>
      )}
      

      {/* Invoice Save Condition */}
      <div className="mb-8">
        {invoiceForm && invoiceForm?.statusIndex !== "3" && (
          <div className="px-4 pt-3">
            <div className="bg-white rounded-xl px-3 py-3">
              <div className="flex flex-col flex-wrap sm:flex-row">
                {params.id === "new" && (
                  <div className="w-full flex-1 my-1 sm:my-1 md:my-0 px-1">
                    <Button
                      outlined={1}
                      size="sm"
                      block={1}
                      secondary={1}
                      onClick={() => saveAs("Draft")}
                    >
                      <CheckCircleIcon className="h-5 w-5 mr-1" /> Save As Draft
                    </Button>
                  </div>
                )}
                {invoiceForm?.statusIndex !== "2" && (
                  <div className="w-full flex-1 my-1 sm:my-1 md:my-0 px-1">
                    <Button
                      outlined={1}
                      size="sm"
                      block={1}
                      danger={1}
                      onClick={() => saveAs("Unpaid")}
                    >
                      <DollarIcon className="h-5 w-5 mr-1" />{" "}
                      {params.id === "new" ? "Save" : "Update"} As Unpaid
                    </Button>
                  </div>
                )}
                <div className="w-full flex-1 my-1 sm:my-1 md:my-0 px-1">
                  <Button
                    size="sm"
                    block={1}
                    success={1}
                    onClick={() => saveAs("Paid")}
                  >
                    <SecurityIcon className="h-5 w-5 mr-1" />{" "}
                    {params.id === "new" ? "Save" : "Update"} As Paid
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default InvoiceDetailScreen;
