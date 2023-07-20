export default function convertFormValuesToArrayObject(formEvent) {
  const formElements = Array.from(formEvent.currentTarget.elements);
  console.log(formElements);
  return formElements.reduce((acc, field) => {
    if (!field.attributes.propertyname) return acc;
    console.log({ ...acc });
    return {
      ...acc,
      [field.attributes.propertyname.value]: field.value,
    };
  }, {});
}
