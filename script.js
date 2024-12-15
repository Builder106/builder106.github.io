let currentSlide = 1;

function showSlide(index) {
  const slides = document.querySelectorAll('.carousel-item');
  if (index >= slides.length) {
    currentSlide = 0;
  } else if (index < 0) {
    currentSlide = slides.length - 1;
  } else {
    currentSlide = index;
  }

  slides.forEach((slide, i) => {
    slide.classList.toggle('active', i === currentSlide);
  });
}

function setActiveSlide(element, projectId) {
   const activeClass = 'active';
   const carouselItems = document.querySelectorAll('.carousel-item');
   const projectSections = document.querySelectorAll('.projects');
 
   carouselItems.forEach(item => {
     item.classList.remove(activeClass);
   });
 
   projectSections.forEach(section => {
     section.style.display = 'none';
   });
 
   element.classList.add(activeClass);
   document.getElementById(projectId).style.display = 'block';
 }

function nextSlide() {
  showSlide(currentSlide - 1);
}

function prevSlide() {
  showSlide(currentSlide + 1);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.carousel-control.next').addEventListener('click', nextSlide);
  document.querySelector('.carousel-control.prev').addEventListener('click', prevSlide);
  showSlide(currentSlide);
});