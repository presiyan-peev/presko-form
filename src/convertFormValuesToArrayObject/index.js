export default function convertFormValuesToArrayObject(formEvent) {
  // console.log(formEvent);
  formEvent.currentTarget.elements.foreach((field) => {
    console.log({
      [field.attributes.propertyname.value]: field.value,
    });
  });
  console.log(formEvent.target[0].attributes.propertyname.value);
}
