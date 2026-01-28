export async function sendPrintRequest({
  printerUrl,
  file,
  settings,
  amount,
  userId,
}) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("pages", settings.pages);
  formData.append("copies", settings.copies);
  formData.append("layout", settings.layout);
  formData.append("duplex", settings.duplex);
  formData.append("cost", amount);
  formData.append("uid", userId);

  const response = await fetch(`${printerUrl}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Printer request failed");
  }

  return true;
}
