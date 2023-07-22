export default function convertFormValuesToArrayObject(formEvent) {
  const formElements = Array.from(formEvent.currentTarget.elements);
  return formElements.reduce((acc, field) => {
    if (!field.attributes.propertyname) return acc;
    return {
      ...acc,
      [field.attributes.propertyname.value]: field.value,
    };
  }, {});
}
