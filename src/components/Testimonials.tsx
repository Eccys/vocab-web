import React, { useRef, useEffect, useState } from 'react';
import '../styles/Testimonials.css';

const Testimonials: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    testimonial: ''
  });

  const testimonials = [
    {
      quote: "Actually makes learning words not terrible.",
      author: "Snoop_Weeeedy",
      rating: 5
    },
    {
      quote: "Test prep was horrendous; now I'm throwing around words like 'perspicacious'; love it <3",
      author: "NIKE6295",
      rating: 5
    },
    {
      quote: "it makes me smarter xd. i guess i like it.",
      author: "Pho3n1x99",
      rating: 5
    },
    {
      quote: "Clean design. Doesn't suck. Unlike most vocab apps I've tried. AND FREE.",
      author: "m9ncrft",
      rating: 5
    },
    {
      quote: "My friends stopped listening. fuck.",
      author: "Calebb9850",
      rating: 5
    }
  ];

  const sliderRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;
    
    let isDown = false;
    let startX: number;
    let scrollLeft: number;
    
    const handleMouseDown = (e: MouseEvent) => {
      isDown = true;
      slider.classList.add('active');
      startX = e.pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    };
    
    const handleMouseLeave = () => {
      isDown = false;
      slider.classList.remove('active');
    };
    
    const handleMouseUp = () => {
      isDown = false;
      slider.classList.remove('active');
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX) * 2;
      slider.scrollLeft = scrollLeft - walk;
    };
    
    slider.addEventListener('mousedown', handleMouseDown);
    slider.addEventListener('mouseleave', handleMouseLeave);
    slider.addEventListener('mouseup', handleMouseUp);
    slider.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      slider.removeEventListener('mousedown', handleMouseDown);
      slider.removeEventListener('mouseleave', handleMouseLeave);
      slider.removeEventListener('mouseup', handleMouseUp);
      slider.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent("New Testimonial Submission");
    const body = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\nTestimonial: ${formData.testimonial}`
    );
    window.location.href = `mailto:help.vocabboost@gmail.com?subject=${subject}&body=${body}`;
    setShowModal(false);
    setFormData({ name: '', email: '', testimonial: '' });
  };

  return (
    <section className="testimonials">
      <div className="container">
        <h2 className="section-title" data-aos="fade-up">What Our Users Say</h2>
        <p className="drag-hint" data-aos="fade-up">Drag right to add your own!</p>
        <div className="testimonial-slider" ref={sliderRef} data-aos="fade-up" data-aos-delay="100">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="testimonial">
              <div className="quote">{testimonial.quote}</div>
              <div className="author">{testimonial.author}</div>
              <div className="rating">
                {Array(testimonial.rating).fill('★').join('')}
              </div>
            </div>
          ))}
          
          <div className="testimonial add-testimonial" onClick={() => setShowModal(true)}>
            <div className="plus-icon">+</div>
            <div className="add-text">Add your own!</div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            <h3>Share Your Experience</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input 
                  type="text" 
                  id="name" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>
              <div className="form-group">
                <label htmlFor="testimonial">Your Testimonial</label>
                <textarea 
                  id="testimonial" 
                  name="testimonial" 
                  value={formData.testimonial} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>
              <button type="submit" className="submit-btn">Submit</button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default Testimonials; 